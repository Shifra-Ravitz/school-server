import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "../../db/prisma.js";
import type { AuthUser } from "../../types/express.js";
import { getViewableClass, teacherClassIds } from "../../utils/access.js";
import { currentSchoolYear } from "../../utils/dates.js";
import { conflict, notFound } from "../../utils/errors.js";
import { classSummary, personSummary, publicUser, publicUserSelect, subjectSummary } from "../../utils/serializers.js";
import { nameSearchWhere } from "../users/users.service.js";
import type { classStudentsQuery, createClassSchema, listClassesQuery, updateClassSchema } from "./classes.schemas.js";

export async function listClasses(auth: AuthUser, q: z.infer<typeof listClassesQuery>) {
  const where: Prisma.ClassWhereInput = {
    schoolId: auth.schoolId,
    ...(q.gradeLevel ? { gradeLevel: q.gradeLevel } : {}),
    ...(q.schoolYear ? { schoolYear: q.schoolYear } : {}),
    ...(auth.role === "TEACHER" ? { id: { in: await teacherClassIds(auth.id) } } : {}),
  };
  const classes = await prisma.class.findMany({
    where,
    orderBy: [{ schoolYear: "desc" }, { gradeLevel: "asc" }, { parallel: "asc" }],
    include: { _count: { select: { students: { where: { isActive: true } } } } },
  });
  return classes.map((c) => ({ ...classSummary(c), studentsCount: c._count.students }));
}

export async function getClass(auth: AuthUser, id: number) {
  await getViewableClass(auth, id);
  const cls = await prisma.class.findUniqueOrThrow({
    where: { id },
    include: {
      _count: { select: { students: { where: { isActive: true } } } },
      assignments: {
        include: { subject: true, teacher: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { subject: { name: "asc" } },
      },
    },
  });
  return {
    ...classSummary(cls),
    studentsCount: cls._count.students,
    assignments: cls.assignments.map((a) => ({
      id: a.id,
      subject: subjectSummary(a.subject),
      teacher: personSummary(a.teacher),
      isMine: a.teacherId === auth.id,
    })),
  };
}

export async function listClassStudents(auth: AuthUser, classId: number, q: z.infer<typeof classStudentsQuery>) {
  await getViewableClass(auth, classId);
  const students = await prisma.user.findMany({
    where: { classId, role: "STUDENT", isActive: true, AND: nameSearchWhere(q.search, q.firstName, q.lastName) },
    orderBy:
      q.sortBy === "firstName"
        ? [{ firstName: q.order }, { lastName: q.order }]
        : q.sortBy === "address"
          ? [{ address: q.order }, { lastName: q.order }, { firstName: q.order }]
          : [{ lastName: q.order }, { firstName: q.order }],
    select: publicUserSelect,
  });
  return students.map(publicUser);
}

async function assertUnique(auth: AuthUser, gradeLevel: number, parallel: number, schoolYear: string, excludeId?: number) {
  const existing = await prisma.class.findFirst({
    where: { schoolId: auth.schoolId, gradeLevel, parallel, schoolYear, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (existing) throw conflict("כיתה כזו כבר קיימת בשנה זו");
}

export async function createClass(auth: AuthUser, data: z.infer<typeof createClassSchema>) {
  const schoolYear = data.schoolYear ?? currentSchoolYear();
  await assertUnique(auth, data.gradeLevel, data.parallel, schoolYear);
  const cls = await prisma.class.create({
    data: { schoolId: auth.schoolId, gradeLevel: data.gradeLevel, parallel: data.parallel, schoolYear },
  });
  return { ...classSummary(cls), studentsCount: 0 };
}

async function findClassInSchool(auth: AuthUser, id: number) {
  const cls = await prisma.class.findFirst({ where: { id, schoolId: auth.schoolId } });
  if (!cls) throw notFound("הכיתה");
  return cls;
}

export async function updateClass(auth: AuthUser, id: number, data: z.infer<typeof updateClassSchema>) {
  const cls = await findClassInSchool(auth, id);
  const merged = { gradeLevel: cls.gradeLevel, parallel: cls.parallel, schoolYear: cls.schoolYear, ...data };
  await assertUnique(auth, merged.gradeLevel, merged.parallel, merged.schoolYear, id);
  const updated = await prisma.class.update({ where: { id }, data: merged });
  const studentsCount = await prisma.user.count({ where: { classId: id, isActive: true } });
  return { ...classSummary(updated), studentsCount };
}

export async function deleteClass(auth: AuthUser, id: number) {
  await findClassInSchool(auth, id);
  const [students, assignments] = await Promise.all([
    prisma.user.count({ where: { classId: id } }),
    prisma.teachingAssignment.count({ where: { classId: id } }),
  ]);
  if (students > 0 || assignments > 0) {
    throw conflict("אפשר למחוק רק כיתה ריקה: בלי תלמידות ובלי שיבוצים", { students, assignments });
  }
  await prisma.class.delete({ where: { id } });
}
