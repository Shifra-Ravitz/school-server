import type { Class, Role, Subject, User } from "@prisma/client";
import { classDisplayName } from "./classNames.js";
import { formatDateOnly, hebrewDateString } from "./dates.js";

/**
 * פונקציות שהופכות רשומות ממסד הנתונים לתשובת JSON.
 * כאן מוודאים שלעולם לא נחשפים שדות רגישים כמו passwordHash.
 */

type ClassLike = Pick<Class, "id" | "gradeLevel" | "parallel" | "schoolYear">;

export function classSummary(c: ClassLike) {
  return { id: c.id, name: classDisplayName(c.gradeLevel, c.parallel), gradeLevel: c.gradeLevel, parallel: c.parallel, schoolYear: c.schoolYear };
}

export function subjectSummary(s: Pick<Subject, "id" | "name">) {
  return { id: s.id, name: s.name };
}

export function personSummary(u: Pick<User, "id" | "firstName" | "lastName">) {
  return { id: u.id, firstName: u.firstName, lastName: u.lastName };
}

type UserWithClass = Pick<
  User,
  "id" | "role" | "firstName" | "lastName" | "email" | "idNumber" | "phone" | "address" | "birthDate" | "classId" | "isActive" | "createdAt"
> & { class?: ClassLike | null };

/** פרטי משתמשת מלאים (בלי סיסמה) */
export function publicUser(u: UserWithClass) {
  return {
    id: u.id,
    role: u.role as Role,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    idNumber: u.idNumber,
    phone: u.phone,
    address: u.address,
    birthDate: u.birthDate ? formatDateOnly(u.birthDate) : null,
    hebrewBirthDate: u.birthDate ? hebrewDateString(u.birthDate) : null,
    classId: u.classId,
    class: u.class ? classSummary(u.class) : null,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
  };
}

/** השדות שצריך לטעון ממסד הנתונים כדי לבנות publicUser */
export const publicUserSelect = {
  id: true,
  role: true,
  firstName: true,
  lastName: true,
  email: true,
  idNumber: true,
  phone: true,
  address: true,
  birthDate: true,
  classId: true,
  isActive: true,
  createdAt: true,
  class: { select: { id: true, gradeLevel: true, parallel: true, schoolYear: true } },
} as const;

/** ממיר ציון מ־Decimal של מסד הנתונים למספר רגיל */
export function scoreToNumber(score: { toNumber(): number } | number | null | undefined): number | null {
  if (score === null || score === undefined) return null;
  return typeof score === "number" ? score : score.toNumber();
}
