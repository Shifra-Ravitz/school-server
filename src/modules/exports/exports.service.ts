import { prisma } from "../../db/prisma.js";
import type { AuthUser } from "../../types/express.js";
import { getManageableAssignment, getViewableClass, teacherClassIds } from "../../utils/access.js";
import { classDisplayName } from "../../utils/classNames.js";
import { formatDateOnly, hebrewDateString } from "../../utils/dates.js";
import { toCsv } from "../../utils/files.js";
import { computeGradebook, loadGradebook } from "../grading/grading.service.js";

/** רשימת תלמידות. מנהלת: כיתה אחת או כל בית הספר. מורה: כיתה שלה או כל הכיתות שלה. */
export async function studentsCsv(auth: AuthUser, classId?: number) {
  let classIds: number[] | undefined;
  if (classId) {
    await getViewableClass(auth, classId);
    classIds = [classId];
  } else if (auth.role === "TEACHER") {
    classIds = await teacherClassIds(auth.id);
  }

  const students = await prisma.user.findMany({
    where: { schoolId: auth.schoolId, role: "STUDENT", isActive: true, ...(classIds ? { classId: { in: classIds } } : {}) },
    include: { class: true },
    orderBy: [{ class: { gradeLevel: "asc" } }, { class: { parallel: "asc" } }, { lastName: "asc" }, { firstName: "asc" }],
  });

  return toCsv(
    ["שם פרטי", "שם משפחה", "תעודת זהות", "כיתה", "טלפון", "כתובת", "מייל", "תאריך לידה", "תאריך לידה עברי"],
    students.map((s) => [
      s.firstName,
      s.lastName,
      s.idNumber,
      s.class ? classDisplayName(s.class.gradeLevel, s.class.parallel) : "",
      s.phone,
      s.address,
      s.email,
      s.birthDate ? formatDateOnly(s.birthDate) : "",
      s.birthDate ? hebrewDateString(s.birthDate) : "",
    ]),
  );
}

/** רשימת מורות עם המקצועות והכיתות שהן מלמדות */
export async function teachersCsv(auth: AuthUser) {
  const teachers = await prisma.user.findMany({
    where: { schoolId: auth.schoolId, role: "TEACHER", isActive: true },
    include: { teachingAssignments: { include: { class: true, subject: true } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return toCsv(
    ["שם פרטי", "שם משפחה", "מייל", "טלפון", "מקצועות וכיתות"],
    teachers.map((t) => [
      t.firstName,
      t.lastName,
      t.email,
      t.phone,
      t.teachingAssignments
        .map((a) => `${a.subject.name} ${classDisplayName(a.class.gradeLevel, a.class.parallel)}`)
        .sort((a, b) => a.localeCompare(b, "he"))
        .join("; "),
    ]),
  );
}

/** ציונים של שיבוץ: לכל תלמידה - כל מבחן, ציון כל תקופה וציון שנתי */
export async function gradesCsv(auth: AuthUser, assignmentId: number) {
  await getManageableAssignment(auth, assignmentId);
  const book = computeGradebook(await loadGradebook(assignmentId));
  const className = book.assignment.class.name;

  const exams = book.periods.flatMap((p) => p.exams.map((e) => ({ ...e, periodName: p.name })));
  const headers = [
    "שם פרטי",
    "שם משפחה",
    "כיתה",
    ...exams.map((e) => `${e.title} (${e.periodName}, ${e.date}, ${e.weight}%)`),
    ...book.periods.map((p) => `ציון ${p.name} (${p.weight}%)`),
    "ציון שנתי",
  ];
  const rows = book.students.map((s) => [
    s.firstName,
    s.lastName,
    className,
    ...exams.map((e) => s.scores[String(e.id)] ?? ""),
    ...book.periods.map((p) => s.periodGrades[String(p.id)] ?? "לא הושלם"),
    s.annualGrade ?? "לא הושלם",
  ]);
  const filename = `grades-${book.assignment.subject.name}-${className}.csv`;
  return { csv: toCsv(headers, rows), filename };
}
