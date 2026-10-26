import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "../../db/prisma.js";
import type { AuthUser } from "../../types/express.js";
import { formatDateOnly, toDateOnly } from "../../utils/dates.js";
import { personSummary, scoreToNumber, subjectSummary } from "../../utils/serializers.js";
import { ATTENDANCE_LABELS, ATTENDANCE_SYMBOLS, computeCounts } from "../attendance/attendance.service.js";
import { computeGradebook, loadGradebook } from "../grading/grading.service.js";
import type { myAttendanceQuery } from "../attendance/attendance.schemas.js";
import type { myGradesQuery } from "./me.schemas.js";

/** השיבוצים (מקצועות) של הכיתה של התלמידה */
async function myAssignments(auth: AuthUser, subjectId?: number) {
  return prisma.teachingAssignment.findMany({
    where: { classId: auth.classId ?? -1, ...(subjectId ? { subjectId } : {}) },
    include: { subject: true, teacher: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { subject: { name: "asc" } },
  });
}

/**
 * הציונים של התלמידה המחוברת, מקובצים לפי מקצוע.
 * לכל מקצוע: תקופות ← מבחנים עם הציון וההערכה, ציון כל תקופה וציון שנתי.
 */
export async function myGrades(auth: AuthUser, q: z.infer<typeof myGradesQuery>) {
  const assignments = await myAssignments(auth, q.subjectId);
  const subjects = [];

  for (const assignment of assignments) {
    const book = await loadGradebook(assignment.id, [auth.id]);
    const computed = computeGradebook(book);
    const me = computed.students[0];
    const evaluations = new Map(book.grades.map((g) => [g.examId, g.evaluation]));
    const scores = new Map(book.grades.map((g) => [g.examId, scoreToNumber(g.score)]));

    const periods = computed.periods
      .filter((p) => !q.periodId || p.id === q.periodId)
      .map((p) => ({
        id: p.id,
        name: p.name,
        weight: p.weight,
        examsWeight: p.examsWeight,
        isComplete: p.isComplete,
        grade: me?.periodGrades[String(p.id)] ?? null,
        exams: p.exams.map((e) => ({
          ...e,
          score: scores.get(e.id) ?? null,
          evaluation: evaluations.get(e.id) ?? null,
        })),
      }));

    if (q.periodId && periods.length === 0) continue;
    subjects.push({
      assignmentId: assignment.id,
      subject: subjectSummary(assignment.subject),
      teacher: personSummary(assignment.teacher),
      periods,
      annualGrade: me?.annualGrade ?? null,
      canCalculateAnnual: computed.canCalculateAnnual,
      problems: computed.problems,
    });
  }
  return { subjects };
}

/** הנוכחות של התלמידה המחוברת: רשימת חריגות + סיכום כללי ולפי מקצוע */
export async function myAttendance(auth: AuthUser, q: z.infer<typeof myAttendanceQuery>) {
  const assignments = await myAssignments(auth, q.subjectId);
  const assignmentIds = assignments.map((a) => a.id);

  const dateFilter: Prisma.DateTimeFilter = {};
  if (q.from) dateFilter.gte = toDateOnly(q.from);
  if (q.to) dateFilter.lte = toDateOnly(q.to);
  const hasDates = Object.keys(dateFilter).length > 0;

  const [records, sessions] = await Promise.all([
    prisma.attendance.findMany({
      where: { studentId: auth.id, assignmentId: { in: assignmentIds }, ...(hasDates ? { date: dateFilter } : {}) },
      orderBy: [{ date: "desc" }, { lessonNumber: "desc" }],
    }),
    prisma.attendanceSession.groupBy({
      by: ["assignmentId"],
      where: { assignmentId: { in: assignmentIds }, ...(hasDates ? { date: dateFilter } : {}) },
      _count: true,
    }),
  ]);
  const sessionsByAssignment = new Map(sessions.map((s) => [s.assignmentId, s._count]));
  const assignmentById = new Map(assignments.map((a) => [a.id, a]));

  const items = records
    .filter((r) => (!q.status || r.status === q.status) && (q.approved === undefined || r.approved === q.approved))
    .map((r) => ({
      id: r.id,
      date: formatDateOnly(r.date),
      lessonNumber: r.lessonNumber,
      status: r.status,
      symbol: ATTENDANCE_SYMBOLS[r.status],
      label: ATTENDANCE_LABELS[r.status],
      approved: r.approved,
      reason: r.reason,
      subject: subjectSummary(assignmentById.get(r.assignmentId)!.subject),
    }));

  const bySubject = assignments.map((a) => ({
    subject: subjectSummary(a.subject),
    ...computeCounts(
      sessionsByAssignment.get(a.id) ?? 0,
      records.filter((r) => r.assignmentId === a.id),
    ),
  }));
  const totalLessons = [...sessionsByAssignment.values()].reduce((s, n) => s + n, 0);

  return {
    items,
    summary: { ...computeCounts(totalLessons, records), bySubject },
  };
}
