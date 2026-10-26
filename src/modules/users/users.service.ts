import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "../../db/prisma.js";
import type { AuthUser } from "../../types/express.js";
import { toDateOnly } from "../../utils/dates.js";
import { badRequest, conflict, notFound } from "../../utils/errors.js";
import {
  assertPasswordAvailable,
  generateAvailablePassword,
  hashPassword,
} from "../../utils/passwords.js";
import { publicUser, publicUserSelect } from "../../utils/serializers.js";
import type { createUserSchema, listUsersQuery, updateUserSchema } from "./users.schemas.js";

/** תנאי חיפוש: כל מילה צריכה להופיע בשם הפרטי, בשם המשפחה או במייל */
export function nameSearchWhere(search?: string, firstName?: string, lastName?: string): Prisma.UserWhereInput[] {
  const conditions: Prisma.UserWhereInput[] = [];
  if (firstName) conditions.push({ firstName: { contains: firstName, mode: "insensitive" } });
  if (lastName) conditions.push({ lastName: { contains: lastName, mode: "insensitive" } });
  if (search) {
    for (const word of search.split(/\s+/).filter(Boolean)) {
      conditions.push({
        OR: [
          { firstName: { contains: word, mode: "insensitive" } },
          { lastName: { contains: word, mode: "insensitive" } },
          { email: { contains: word, mode: "insensitive" } },
          { idNumber: { startsWith: word } },
        ],
      });
    }
  }
  return conditions;
}

export async function listUsers(auth: AuthUser, q: z.infer<typeof listUsersQuery>) {
  const where: Prisma.UserWhereInput = {
    schoolId: auth.schoolId,
    ...(q.role ? { role: q.role } : {}),
    ...(q.classId ? { classId: q.classId } : {}),
    ...(q.isActive === "all" ? {} : { isActive: q.isActive === "true" }),
    AND: nameSearchWhere(q.search, q.firstName, q.lastName),
  };
  const orderBy: Prisma.UserOrderByWithRelationInput[] =
    q.sortBy === "lastName"
      ? [{ lastName: q.order }, { firstName: q.order }]
      : q.sortBy === "firstName"
        ? [{ firstName: q.order }, { lastName: q.order }]
        : [{ createdAt: q.order }];

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      select: publicUserSelect,
    }),
  ]);
  return { items: users.map(publicUser), total, page: q.page, pageSize: q.pageSize };
}

async function findUserInSchool(auth: AuthUser, id: number) {
  const user = await prisma.user.findFirst({
    where: { id, schoolId: auth.schoolId },
    select: { ...publicUserSelect, passwordHash: false },
  });
  if (!user) throw notFound("המשתמשת");
  return user;
}

export async function getUser(auth: AuthUser, id: number) {
  return publicUser(await findUserInSchool(auth, id));
}

async function assertClassInSchool(auth: AuthUser, classId: number) {
  const cls = await prisma.class.findFirst({ where: { id: classId, schoolId: auth.schoolId } });
  if (!cls) throw badRequest("הכיתה שנבחרה לא קיימת", [{ field: "classId", message: "כיתה לא קיימת" }]);
}

/** אותה תעודת זהות לא יכולה להופיע פעמיים באותו בית ספר */
async function assertIdNumberFree(auth: AuthUser, idNumber: string, excludeUserId?: number) {
  const existing = await prisma.user.findFirst({
    where: { schoolId: auth.schoolId, idNumber, ...(excludeUserId ? { id: { not: excludeUserId } } : {}) },
    select: { id: true },
  });
  if (existing) throw conflict("כבר קיימת משתמשת עם תעודת זהות זו");
}

export async function createUser(auth: AuthUser, data: z.infer<typeof createUserSchema>) {
  if (data.classId) await assertClassInSchool(auth, data.classId);
  if (data.idNumber) await assertIdNumberFree(auth, data.idNumber);

  let plainPassword = data.password;
  let generatedPassword: string | null = null;
  if (plainPassword) {
    await assertPasswordAvailable(data.email, plainPassword);
  } else {
    plainPassword = await generateAvailablePassword(data.email);
    generatedPassword = plainPassword;
  }

  const user = await prisma.user.create({
    data: {
      schoolId: auth.schoolId,
      role: data.role,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      idNumber: data.idNumber ?? null,
      passwordHash: await hashPassword(plainPassword),
      phone: data.phone ?? null,
      address: data.address ?? null,
      birthDate: data.birthDate ? toDateOnly(data.birthDate) : null,
      classId: data.role === "STUDENT" ? data.classId! : null,
    },
    select: publicUserSelect,
  });
  return { user: publicUser(user), generatedPassword };
}

export async function updateUser(auth: AuthUser, id: number, data: z.infer<typeof updateUserSchema>) {
  const existing = await findUserInSchool(auth, id);

  if (data.isActive === false && id === auth.id) throw badRequest("אי אפשר להשבית את החשבון של עצמך");
  if (existing.role === "STUDENT") {
    if (data.classId === null) throw badRequest("לתלמידה חובה כיתה", [{ field: "classId", message: "שדה חובה" }]);
    if (data.birthDate === null) throw badRequest("לתלמידה חובה תאריך לידה", [{ field: "birthDate", message: "שדה חובה" }]);
  } else if (data.classId) {
    throw badRequest("רק לתלמידה משייכים כיתה", [{ field: "classId", message: "לא רלוונטי" }]);
  }
  if (data.classId) await assertClassInSchool(auth, data.classId);
  if (data.idNumber) await assertIdNumberFree(auth, data.idNumber, id);
  if (existing.role === "STUDENT" && data.idNumber === null) {
    throw badRequest("לתלמידה חובה תעודת זהות", [{ field: "idNumber", message: "שדה חובה" }]);
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      idNumber: data.idNumber,
      phone: data.phone,
      address: data.address,
      birthDate: data.birthDate === undefined ? undefined : data.birthDate ? toDateOnly(data.birthDate) : null,
      classId: existing.role === "STUDENT" ? data.classId ?? undefined : undefined,
      isActive: data.isActive,
    },
    select: publicUserSelect,
  });
  return publicUser(user);
}

/** איפוס סיסמה על ידי המנהלת. מחזיר את הסיסמה החדשה פעם אחת. */
export async function resetPassword(auth: AuthUser, id: number, password?: string) {
  const user = await findUserInSchool(auth, id);
  let plain = password;
  if (plain) await assertPasswordAvailable(user.email, plain, id);
  else plain = await generateAvailablePassword(user.email, id);
  await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(plain) } });
  return { temporaryPassword: plain };
}
