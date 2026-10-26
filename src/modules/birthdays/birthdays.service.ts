import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import type { AuthUser } from "../../types/express.js";
import { teacherClassIds } from "../../utils/access.js";
import { classDisplayName } from "../../utils/classNames.js";
import { hebrewAge, hebrewDateString, isHebrewBirthday, toDateOnly, todayInIsrael } from "../../utils/dates.js";

/**
 * ברכות יום הולדת לפי התאריך העברי.
 * לא נשמרות בטבלה - מחושבות בכל בקשה מתוך תאריך הלידה.
 * מנהלת: כל תלמידות בית הספר. מורה: התלמידות שהיא מלמדת. תלמידה: רק היא עצמה.
 */
export async function todaysBirthdays(auth: AuthUser, date?: string) {
  const day = date ?? todayInIsrael();
  const onDate = toDateOnly(day);

  let where: Prisma.UserWhereInput = { schoolId: auth.schoolId, role: "STUDENT", isActive: true, birthDate: { not: null } };
  if (auth.role === "TEACHER") where = { ...where, classId: { in: await teacherClassIds(auth.id) } };
  if (auth.role === "STUDENT") where = { ...where, id: auth.id };

  const students = await prisma.user.findMany({
    where,
    select: { id: true, firstName: true, lastName: true, birthDate: true, class: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const celebrating = students.filter((s) => s.birthDate && isHebrewBirthday(s.birthDate, onDate));
  const isMyBirthday = auth.role === "STUDENT" && celebrating.some((s) => s.id === auth.id);

  return {
    date: day,
    hebrewDate: hebrewDateString(onDate),
    isMyBirthday,
    items: celebrating.map((s) => {
      const className = s.class ? classDisplayName(s.class.gradeLevel, s.class.parallel) : null;
      return {
        studentId: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        className,
        age: hebrewAge(s.birthDate!, onDate),
        hebrewBirthDate: hebrewDateString(s.birthDate!),
        greeting:
          auth.role === "STUDENT"
            ? `מזל טוב, ${s.firstName}! יום הולדת שמח!`
            : `מזל טוב ל${s.firstName} ${s.lastName}${className ? ` מכיתה ${className}` : ""} ליום הולדתה!`,
      };
    }),
  };
}
