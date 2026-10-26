import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "../../db/prisma.js";
import type { AuthUser } from "../../types/express.js";
import { getManageableAssignment, getViewableClass } from "../../utils/access.js";
import { conflict, notFound } from "../../utils/errors.js";
import { classSummary, personSummary, subjectSummary } from "../../utils/serializers.js";
import type { createLessonSchema, updateLessonSchema } from "./schedule.schemas.js";

export const DAY_NAMES = ["", "ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי"];

const include = {
  assignment: {
    include: { class: true, subject: true, teacher: { select: { id: true, firstName: true, lastName: true } } },
  },
} as const;

type LessonWithRelations = Prisma.LessonGetPayload<{ include: typeof include }>;

function serialize(l: LessonWithRelations) {
  return {
    id: l.id,
    dayOfWeek: l.dayOfWeek,
    dayName: DAY_NAMES[l.dayOfWeek] ?? "",
    lessonNumber: l.lessonNumber,
    room: l.room,
    assignmentId: l.assignmentId,
    subject: subjectSummary(l.assignment.subject),
    class: classSummary(l.assignment.class),
    teacher: personSummary(l.assignment.teacher),
  };
}

const orderBy: Prisma.LessonOrderByWithRelationInput[] = [{ dayOfWeek: "asc" }, { lessonNumber: "asc" }];

/**
 * "המערכת שלי":
 * מורה (וגם מנהלת שמלמדת) - כל השיעורים שהיא מלמדת, בכל הכיתות.
 * תלמידה - כל השיעורים של הכיתה שלה, עם כל המורות.
 */
export async function mySchedule(auth: AuthUser) {
  const where: Prisma.LessonWhereInput =
    auth.role === "STUDENT"
      ? { assignment: { classId: auth.classId ?? -1 } }
      : { assignment: { teacherId: auth.id } };
  const lessons = await prisma.lesson.findMany({ where, include, orderBy });
  return lessons.map(serialize);
}

export async function classSchedule(auth: AuthUser, classId: number) {
  await getViewableClass(auth, classId);
  const lessons = await prisma.lesson.findMany({ where: { assignment: { classId } }, include, orderBy });
  return lessons.map(serialize);
}

export async function teacherSchedule(auth: AuthUser, teacherId: number) {
  const teacher = await prisma.user.findFirst({ where: { id: teacherId, schoolId: auth.schoolId, role: "TEACHER" } });
  if (!teacher) throw notFound("המורה");
  const lessons = await prisma.lesson.findMany({ where: { assignment: { teacherId } }, include, orderBy });
  return lessons.map(serialize);
}

/** אין שני שיעורים לאותה כיתה באותה שעה, ואין שני שיעורים לאותה מורה באותה שעה */
async function assertNoClash(
  assignment: { classId: number; teacherId: number },
  dayOfWeek: number,
  lessonNumber: number,
  excludeLessonId?: number,
) {
  const base = { dayOfWeek, lessonNumber, ...(excludeLessonId ? { id: { not: excludeLessonId } } : {}) };
  const classClash = await prisma.lesson.findFirst({
    where: { ...base, assignment: { classId: assignment.classId } },
    include,
  });
  if (classClash) {
    throw conflict(
      `לכיתה כבר יש שיעור ${classClash.assignment.subject.name} ביום ${DAY_NAMES[dayOfWeek]} בשעה ${lessonNumber}`,
    );
  }
  const teacherClash = await prisma.lesson.findFirst({
    where: { ...base, assignment: { teacherId: assignment.teacherId } },
    include,
  });
  if (teacherClash) {
    throw conflict(
      `למורה כבר יש שיעור בכיתה ${classSummary(teacherClash.assignment.class).name} ביום ${DAY_NAMES[dayOfWeek]} בשעה ${lessonNumber}`,
    );
  }
}

export async function createLesson(auth: AuthUser, data: z.infer<typeof createLessonSchema>) {
  const assignment = await getManageableAssignment(auth, data.assignmentId);
  await assertNoClash(assignment, data.dayOfWeek, data.lessonNumber);
  const lesson = await prisma.lesson.create({
    data: { assignmentId: data.assignmentId, dayOfWeek: data.dayOfWeek, lessonNumber: data.lessonNumber, room: data.room ?? null },
    include,
  });
  return serialize(lesson);
}

async function getManageableLesson(auth: AuthUser, id: number) {
  const lesson = await prisma.lesson.findUnique({ where: { id } });
  if (!lesson) throw notFound("השיעור");
  try {
    await getManageableAssignment(auth, lesson.assignmentId);
  } catch (err) {
    if (err instanceof Error && "status" in err && (err as { status: number }).status === 404) throw notFound("השיעור");
    throw err;
  }
  return lesson;
}

export async function updateLesson(auth: AuthUser, id: number, data: z.infer<typeof updateLessonSchema>) {
  const lesson = await getManageableLesson(auth, id);
  const assignmentId = data.assignmentId ?? lesson.assignmentId;
  const assignment = await getManageableAssignment(auth, assignmentId);
  await assertNoClash(assignment, data.dayOfWeek ?? lesson.dayOfWeek, data.lessonNumber ?? lesson.lessonNumber, id);
  const updated = await prisma.lesson.update({
    where: { id },
    data: { assignmentId, dayOfWeek: data.dayOfWeek, lessonNumber: data.lessonNumber, room: data.room },
    include,
  });
  return serialize(updated);
}

export async function deleteLesson(auth: AuthUser, id: number) {
  await getManageableLesson(auth, id);
  await prisma.lesson.delete({ where: { id } });
}
