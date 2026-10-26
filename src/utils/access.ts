import { prisma } from "../db/prisma.js";
import type { AuthUser } from "../types/express.js";
import { forbidden, notFound } from "./errors.js";

/**
 * בדיקות הרשאה משותפות.
 * כלל ההפרדה בין בתי ספר: רשומה של בית ספר אחר מחזירה 404 (כאילו אינה קיימת).
 * כלל ההפרדה בין מורות: מורה שמנסה לגשת לשיבוץ של מורה אחרת מקבלת 403.
 */

const assignmentInclude = {
  class: true,
  subject: true,
  teacher: { select: { id: true, firstName: true, lastName: true } },
} as const;

/** שיבוץ שהמשתמשת רשאית לנהל: מנהלת - כל שיבוץ בבית הספר, מורה - רק שלה */
export async function getManageableAssignment(auth: AuthUser, assignmentId: number) {
  const assignment = await prisma.teachingAssignment.findUnique({
    where: { id: assignmentId },
    include: assignmentInclude,
  });
  if (!assignment || assignment.class.schoolId !== auth.schoolId) throw notFound("השיבוץ");
  if (auth.role === "PRINCIPAL") return assignment;
  if (auth.role === "TEACHER" && assignment.teacherId === auth.id) return assignment;
  throw forbidden("אין לך הרשאה לשיבוץ זה");
}

/** כיתה שהמשתמשת רשאית לראות: מנהלת - כל כיתה, מורה - כיתה שהיא מלמדת בה */
export async function getViewableClass(auth: AuthUser, classId: number) {
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls || cls.schoolId !== auth.schoolId) throw notFound("הכיתה");
  if (auth.role === "PRINCIPAL") return cls;
  if (auth.role === "TEACHER") {
    const teaches = await prisma.teachingAssignment.count({ where: { classId, teacherId: auth.id } });
    if (teaches > 0) return cls;
  }
  throw forbidden("אין לך הרשאה לכיתה זו");
}

/** מזהי הכיתות שמורה מלמדת בהן */
export async function teacherClassIds(teacherId: number): Promise<number[]> {
  const rows = await prisma.teachingAssignment.findMany({
    where: { teacherId },
    select: { classId: true },
    distinct: ["classId"],
  });
  return rows.map((r) => r.classId);
}

/** תקופת ציון שהמשתמשת רשאית לנהל */
export async function getManageablePeriod(auth: AuthUser, periodId: number) {
  const period = await prisma.gradePeriod.findUnique({ where: { id: periodId } });
  if (!period) throw notFound("התקופה");
  const assignment = await getManageableAssignment(auth, period.assignmentId).catch((err: unknown) => {
    // תקופה של בית ספר אחר - מחזירים "לא נמצאה"
    if (err instanceof Error && "status" in err && (err as { status: number }).status === 404) throw notFound("התקופה");
    throw err;
  });
  return { period, assignment };
}

/** מבחן שהמשתמשת רשאית לנהל */
export async function getManageableExam(auth: AuthUser, examId: number) {
  const exam = await prisma.exam.findUnique({ where: { id: examId }, include: { period: true } });
  if (!exam) throw notFound("המבחן");
  const assignment = await getManageableAssignment(auth, exam.period.assignmentId).catch((err: unknown) => {
    if (err instanceof Error && "status" in err && (err as { status: number }).status === 404) throw notFound("המבחן");
    throw err;
  });
  return { exam, assignment };
}
