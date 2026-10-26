import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "../../db/prisma.js";
import type { AuthUser } from "../../types/express.js";
import { getManageableAssignment } from "../../utils/access.js";
import { badRequest, conflict, notFound } from "../../utils/errors.js";
import { classSummary, personSummary, subjectSummary } from "../../utils/serializers.js";
import type { createAssignmentSchema, listAssignmentsQuery } from "./assignments.schemas.js";

/** תקופות ברירת המחדל שנוצרות לכל שיבוץ חדש */
export const DEFAULT_PERIODS = [
  { name: "מחצית א'", weight: 50, sortOrder: 1 },
  { name: "מחצית ב'", weight: 50, sortOrder: 2 },
];

const include = {
  class: true,
  subject: true,
  teacher: { select: { id: true, firstName: true, lastName: true } },
} as const;

type AssignmentWithRelations = Prisma.TeachingAssignmentGetPayload<{ include: typeof include }>;

function serialize(a: AssignmentWithRelations, studentsCount?: number) {
  return {
    id: a.id,
    class: classSummary(a.class),
    subject: subjectSummary(a.subject),
    teacher: personSummary(a.teacher),
    ...(studentsCount !== undefined ? { studentsCount } : {}),
  };
}

async function countStudents(classIds: number[]) {
  const rows = await prisma.user.groupBy({
    by: ["classId"],
    where: { classId: { in: classIds }, role: "STUDENT", isActive: true },
    _count: true,
  });
  return new Map(rows.map((r) => [r.classId, r._count]));
}

export async function listAssignments(auth: AuthUser, q: z.infer<typeof listAssignmentsQuery>) {
  const assignments = await prisma.teachingAssignment.findMany({
    where: {
      class: { schoolId: auth.schoolId },
      ...(q.classId ? { classId: q.classId } : {}),
      ...(q.subjectId ? { subjectId: q.subjectId } : {}),
      // מורה רואה רק את השיבוצים שלה
      ...(auth.role === "TEACHER" ? { teacherId: auth.id } : q.teacherId ? { teacherId: q.teacherId } : {}),
    },
    include,
    orderBy: [{ class: { gradeLevel: "asc" } }, { class: { parallel: "asc" } }, { subject: { name: "asc" } }],
  });
  const counts = await countStudents([...new Set(assignments.map((a) => a.classId))]);
  return assignments.map((a) => serialize(a, counts.get(a.classId) ?? 0));
}

export async function getAssignment(auth: AuthUser, id: number) {
  const a = await getManageableAssignment(auth, id);
  const counts = await countStudents([a.classId]);
  return serialize(a, counts.get(a.classId) ?? 0);
}

async function assertTeacher(auth: AuthUser, teacherId: number) {
  const teacher = await prisma.user.findFirst({
    where: { id: teacherId, schoolId: auth.schoolId, role: "TEACHER", isActive: true },
  });
  if (!teacher) throw badRequest("המורה שנבחרה לא קיימת", [{ field: "teacherId", message: "מורה לא קיימת" }]);
}

export async function createAssignment(auth: AuthUser, data: z.infer<typeof createAssignmentSchema>) {
  const [cls, subject] = await Promise.all([
    prisma.class.findFirst({ where: { id: data.classId, schoolId: auth.schoolId } }),
    prisma.subject.findFirst({ where: { id: data.subjectId, schoolId: auth.schoolId } }),
  ]);
  if (!cls) throw badRequest("הכיתה לא קיימת", [{ field: "classId", message: "כיתה לא קיימת" }]);
  if (!subject) throw badRequest("המקצוע לא קיים", [{ field: "subjectId", message: "מקצוע לא קיים" }]);
  await assertTeacher(auth, data.teacherId);

  const existing = await prisma.teachingAssignment.findUnique({
    where: { classId_subjectId: { classId: data.classId, subjectId: data.subjectId } },
  });
  if (existing) throw conflict("למקצוע הזה בכיתה הזו כבר משובצת מורה. אפשר להחליף מורה בשיבוץ הקיים.");

  const created = await prisma.teachingAssignment.create({
    data: { ...data, periods: { create: DEFAULT_PERIODS } },
    include,
  });
  const counts = await countStudents([created.classId]);
  return serialize(created, counts.get(created.classId) ?? 0);
}

async function findAssignmentInSchool(auth: AuthUser, id: number) {
  const a = await prisma.teachingAssignment.findFirst({ where: { id, class: { schoolId: auth.schoolId } } });
  if (!a) throw notFound("השיבוץ");
  return a;
}

export async function updateAssignment(auth: AuthUser, id: number, teacherId: number) {
  await findAssignmentInSchool(auth, id);
  await assertTeacher(auth, teacherId);
  // השיעורים במערכת עוברים יחד עם השיבוץ למורה החדשה - בודקים שאין לה שיעור אחר באותן שעות
  const lessons = await prisma.lesson.findMany({ where: { assignmentId: id } });
  if (lessons.length > 0) {
    const clash = await prisma.lesson.findFirst({
      where: {
        assignmentId: { not: id },
        assignment: { teacherId },
        OR: lessons.map((l) => ({ dayOfWeek: l.dayOfWeek, lessonNumber: l.lessonNumber })),
      },
    });
    if (clash) throw conflict("למורה החדשה יש כבר שיעור באחת השעות של שיבוץ זה. יש לשנות קודם את מערכת השעות.");
  }
  const updated = await prisma.teachingAssignment.update({ where: { id }, data: { teacherId }, include });
  const counts = await countStudents([updated.classId]);
  return serialize(updated, counts.get(updated.classId) ?? 0);
}

export async function deleteAssignment(auth: AuthUser, id: number) {
  await findAssignmentInSchool(auth, id);
  const [grades, attendance] = await Promise.all([
    prisma.grade.count({ where: { exam: { period: { assignmentId: id } } } }),
    prisma.attendance.count({ where: { assignmentId: id } }),
  ]);
  if (grades > 0 || attendance > 0) {
    throw conflict("אי אפשר למחוק שיבוץ שיש בו ציונים או נוכחות. אפשר להחליף מורה.", { grades, attendance });
  }
  await prisma.teachingAssignment.delete({ where: { id } });
}
