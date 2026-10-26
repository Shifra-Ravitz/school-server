import { prisma } from "../../db/prisma.js";
import type { AuthUser } from "../../types/express.js";
import { conflict, notFound } from "../../utils/errors.js";
import { subjectSummary } from "../../utils/serializers.js";

export async function listSubjects(auth: AuthUser) {
  const subjects = await prisma.subject.findMany({ where: { schoolId: auth.schoolId }, orderBy: { name: "asc" } });
  return subjects.map(subjectSummary);
}

async function assertNameFree(auth: AuthUser, name: string, excludeId?: number) {
  const existing = await prisma.subject.findFirst({
    where: { schoolId: auth.schoolId, name, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (existing) throw conflict("מקצוע בשם זה כבר קיים");
}

async function findSubject(auth: AuthUser, id: number) {
  const subject = await prisma.subject.findFirst({ where: { id, schoolId: auth.schoolId } });
  if (!subject) throw notFound("המקצוע");
  return subject;
}

export async function createSubject(auth: AuthUser, name: string) {
  await assertNameFree(auth, name);
  return subjectSummary(await prisma.subject.create({ data: { schoolId: auth.schoolId, name } }));
}

export async function updateSubject(auth: AuthUser, id: number, name: string) {
  await findSubject(auth, id);
  await assertNameFree(auth, name, id);
  return subjectSummary(await prisma.subject.update({ where: { id }, data: { name } }));
}

export async function deleteSubject(auth: AuthUser, id: number) {
  await findSubject(auth, id);
  const used = await prisma.teachingAssignment.count({ where: { subjectId: id } });
  if (used > 0) throw conflict("אי אפשר למחוק מקצוע שיש לו שיבוצים", { assignments: used });
  await prisma.subject.delete({ where: { id } });
}
