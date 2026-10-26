import type { AttendanceStatus, Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "../../db/prisma.js";
import type { AuthUser } from "../../types/express.js";
import { getManageableAssignment } from "../../utils/access.js";
import { formatDateOnly, toDateOnly } from "../../utils/dates.js";
import { badRequest, notFound } from "../../utils/errors.js";
import { round1 } from "../../utils/gradeCalculator.js";
import { personSummary } from "../../utils/serializers.js";
import { nameSearchWhere } from "../users/users.service.js";
import type {
  lessonRosterQuery,
  listAttendanceQuery,
  saveLessonAttendanceSchema,
  updateAttendanceSchema,
} from "./attendance.schemas.js";

/** הסימן שמוצג לכל סטטוס. נוכחת = ריק. */
export const ATTENDANCE_SYMBOLS: Record<AttendanceStatus, string> = {
  LATE: "+",
  ABSENT: "-",
  RELEASED: "ש",
};

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  LATE: "איחור",
  ABSENT: "חיסור",
  RELEASED: "שחרור",
};

type AttendanceRow = Prisma.AttendanceGetPayload<{
  include: { student: { select: { id: true; firstName: true; lastName: true } } };
}>;

export function serializeAttendance(r: Omit<AttendanceRow, "student"> & { student?: AttendanceRow["student"] }) {
  return {
    id: r.id,
    assignmentId: r.assignmentId,
    date: formatDateOnly(r.date),
    lessonNumber: r.lessonNumber,
    status: r.status,
    symbol: ATTENDANCE_SYMBOLS[r.status],
    label: ATTENDANCE_LABELS[r.status],
    approved: r.approved,
    reason: r.reason,
    ...(r.student ? { student: personSummary(r.student) } : {}),
  };
}

export async function listAttendance(auth: AuthUser, assignmentId: number, q: z.infer<typeof listAttendanceQuery>) {
  await getManageableAssignment(auth, assignmentId);
  const dateFilter: Prisma.DateTimeFilter = {};
  if (q.date) dateFilter.equals = toDateOnly(q.date);
  if (q.from) dateFilter.gte = toDateOnly(q.from);
  if (q.to) dateFilter.lte = toDateOnly(q.to);

  const rows = await prisma.attendance.findMany({
    where: {
      assignmentId,
      ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
      ...(q.lessonNumber ? { lessonNumber: q.lessonNumber } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.approved !== undefined ? { approved: q.approved } : {}),
      ...(q.studentId ? { studentId: q.studentId } : {}),
      student: { AND: nameSearchWhere(q.search, q.firstName, q.lastName) },
    },
    include: { student: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: [{ date: q.order }, { lessonNumber: q.order }, { student: { lastName: "asc" } }],
  });
  return rows.map(serializeAttendance);
}

/** כל תלמידות הכיתה בשיעור מסוים, עם הסימון של כל אחת (או נוכחת) */
async function lessonRoster(assignmentId: number, classId: number, date: string, lessonNumber: number) {
  const day = toDateOnly(date);
  const [students, records, session] = await Promise.all([
    prisma.user.findMany({
      where: { classId, role: "STUDENT", isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.attendance.findMany({ where: { assignmentId, date: day, lessonNumber } }),
    prisma.attendanceSession.findUnique({
      where: { assignmentId_date_lessonNumber: { assignmentId, date: day, lessonNumber } },
    }),
  ]);
  const byStudent = new Map(records.map((r) => [r.studentId, r]));
  return {
    date,
    lessonNumber,
    // האם המורה כבר שמרה נוכחות לשיעור הזה
    taken: session !== null,
    items: students.map((s) => {
      const r = byStudent.get(s.id);
      return {
        student: personSummary(s),
        attendanceId: r?.id ?? null,
        status: r?.status ?? null,
        symbol: r ? ATTENDANCE_SYMBOLS[r.status] : "",
        approved: r?.approved ?? false,
        reason: r?.reason ?? null,
      };
    }),
  };
}

export async function getLessonRoster(auth: AuthUser, assignmentId: number, q: z.infer<typeof lessonRosterQuery>) {
  const assignment = await getManageableAssignment(auth, assignmentId);
  return lessonRoster(assignmentId, assignment.classId, q.date, q.lessonNumber);
}

/**
 * שמירת נוכחות לשיעור אחד.
 * הרשימה שנשלחת היא כל החריגות בשיעור. חריגה שהייתה ולא נשלחה שוב - נמחקת (התלמידה נוכחת).
 */
export async function saveLessonAttendance(
  auth: AuthUser,
  assignmentId: number,
  data: z.infer<typeof saveLessonAttendanceSchema>,
) {
  const assignment = await getManageableAssignment(auth, assignmentId);
  const day = toDateOnly(data.date);

  const ids = data.records.map((r) => r.studentId);
  const valid = await prisma.user.findMany({
    where: { id: { in: ids }, classId: assignment.classId, role: "STUDENT", isActive: true },
    select: { id: true },
  });
  const validIds = new Set(valid.map((v) => v.id));
  const invalid = ids.filter((id) => !validIds.has(id));
  if (invalid.length > 0) {
    throw badRequest(
      "חלק מהתלמידות אינן בכיתה",
      invalid.map((id) => ({ field: "records.studentId", message: `תלמידה ${id} לא שייכת לכיתה` })),
    );
  }

  await prisma.$transaction([
    prisma.attendanceSession.upsert({
      where: { assignmentId_date_lessonNumber: { assignmentId, date: day, lessonNumber: data.lessonNumber } },
      create: { assignmentId, date: day, lessonNumber: data.lessonNumber },
      update: {},
    }),
    prisma.attendance.deleteMany({
      where: { assignmentId, date: day, lessonNumber: data.lessonNumber, studentId: { notIn: ids } },
    }),
    ...data.records.map((r) =>
      prisma.attendance.upsert({
        where: {
          assignmentId_studentId_date_lessonNumber: {
            assignmentId,
            studentId: r.studentId,
            date: day,
            lessonNumber: data.lessonNumber,
          },
        },
        create: {
          assignmentId,
          studentId: r.studentId,
          date: day,
          lessonNumber: data.lessonNumber,
          status: r.status,
          approved: r.approved ?? false,
          reason: r.reason ?? null,
        },
        // approved ו־reason שלא נשלחו - נשארים כמו שהיו
        update: { status: r.status, approved: r.approved, reason: r.reason },
      }),
    ),
  ]);

  return lessonRoster(assignmentId, assignment.classId, data.date, data.lessonNumber);
}

async function getManageableRecord(auth: AuthUser, id: number) {
  const record = await prisma.attendance.findUnique({ where: { id } });
  if (!record) throw notFound("רשומת הנוכחות");
  try {
    await getManageableAssignment(auth, record.assignmentId);
  } catch (err) {
    if (err instanceof Error && "status" in err && (err as { status: number }).status === 404) {
      throw notFound("רשומת הנוכחות");
    }
    throw err;
  }
  return record;
}

export async function updateAttendance(auth: AuthUser, id: number, data: z.infer<typeof updateAttendanceSchema>) {
  await getManageableRecord(auth, id);
  const updated = await prisma.attendance.update({
    where: { id },
    data: { status: data.status, approved: data.approved, reason: data.reason },
    include: { student: { select: { id: true, firstName: true, lastName: true } } },
  });
  return serializeAttendance(updated);
}

export async function deleteAttendance(auth: AuthUser, id: number) {
  await getManageableRecord(auth, id);
  await prisma.attendance.delete({ where: { id } });
}

// ================= סיכום נוכחות =================

export interface AttendanceCounts {
  lessons: number;
  late: number;
  absent: number;
  released: number;
  approved: number;
  attendancePercent: number | null;
}

/**
 * אחוז נוכחות = השיעורים שבהם לא נרשם חיסור לא מאושר ÷ כל השיעורים שבהם נבדקה נוכחות.
 * איחורים, שחרורים וחיסורים מאושרים לא מורידים מהאחוז.
 */
export function computeCounts(
  lessons: number,
  records: Array<{ status: AttendanceStatus; approved: boolean }>,
): AttendanceCounts {
  const late = records.filter((r) => r.status === "LATE").length;
  const absent = records.filter((r) => r.status === "ABSENT").length;
  const released = records.filter((r) => r.status === "RELEASED").length;
  const approved = records.filter((r) => r.approved).length;
  const unapprovedAbsent = records.filter((r) => r.status === "ABSENT" && !r.approved).length;
  return {
    lessons,
    late,
    absent,
    released,
    approved,
    attendancePercent: lessons > 0 ? round1(((lessons - Math.min(unapprovedAbsent, lessons)) / lessons) * 100) : null,
  };
}

