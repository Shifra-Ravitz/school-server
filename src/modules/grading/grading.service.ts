import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "../../db/prisma.js";
import type { AuthUser } from "../../types/express.js";
import {
  getManageableAssignment,
  getManageableExam,
  getManageablePeriod,
} from "../../utils/access.js";
import { formatDateOnly, toDateOnly } from "../../utils/dates.js";
import { badRequest, businessRule, conflict } from "../../utils/errors.js";
import { assignmentStatus, round1, studentGrades, sumWeights } from "../../utils/gradeCalculator.js";
import { classSummary, personSummary, scoreToNumber, subjectSummary } from "../../utils/serializers.js";
import type {
  createExamSchema,
  createPeriodSchema,
  finalGradesQuery,
  listExamsQuery,
  saveGradebookSchema,
  saveGradesSchema,
  updateExamSchema,
  updatePeriodSchema,
} from "./grading.schemas.js";

// ================= תקופות ציון =================

async function periodsOverview(assignmentId: number) {
  const periods = await prisma.gradePeriod.findMany({
    where: { assignmentId },
    include: { exams: { select: { id: true, weight: true } } },
  });
  const status = assignmentStatus(periods);
  return { items: status.periods, totalWeight: status.periodsWeight, canCalculateAnnual: status.canCalculateAnnual, problems: status.problems };
}

export async function listPeriods(auth: AuthUser, assignmentId: number) {
  await getManageableAssignment(auth, assignmentId);
  return periodsOverview(assignmentId);
}

async function assertPeriodWeight(assignmentId: number, weight: number, excludePeriodId?: number) {
  const others = await prisma.gradePeriod.findMany({
    where: { assignmentId, ...(excludePeriodId ? { id: { not: excludePeriodId } } : {}) },
    select: { weight: true },
  });
  const total = sumWeights(others) + weight;
  if (total > 100) {
    throw businessRule("WEIGHT_EXCEEDED", `סכום משקלי התקופות יהיה ${total}%, המקסימום הוא 100%`, {
      currentTotal: total - weight,
      maxAllowed: 100 - (total - weight),
    });
  }
}

async function assertPeriodNameFree(assignmentId: number, name: string, excludeId?: number) {
  const existing = await prisma.gradePeriod.findFirst({
    where: { assignmentId, name, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (existing) throw conflict("כבר קיימת תקופה בשם זה");
}

export async function createPeriod(auth: AuthUser, assignmentId: number, data: z.infer<typeof createPeriodSchema>) {
  await getManageableAssignment(auth, assignmentId);
  await assertPeriodNameFree(assignmentId, data.name);
  await assertPeriodWeight(assignmentId, data.weight);
  const maxOrder = await prisma.gradePeriod.aggregate({ where: { assignmentId }, _max: { sortOrder: true } });
  await prisma.gradePeriod.create({
    data: { assignmentId, name: data.name, weight: data.weight, sortOrder: data.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1 },
  });
  return periodsOverview(assignmentId);
}

export async function updatePeriod(auth: AuthUser, periodId: number, data: z.infer<typeof updatePeriodSchema>) {
  const { period } = await getManageablePeriod(auth, periodId);
  if (data.name) await assertPeriodNameFree(period.assignmentId, data.name, periodId);
  if (data.weight !== undefined) await assertPeriodWeight(period.assignmentId, data.weight, periodId);
  await prisma.gradePeriod.update({ where: { id: periodId }, data });
  return periodsOverview(period.assignmentId);
}

export async function deletePeriod(auth: AuthUser, periodId: number) {
  await getManageablePeriod(auth, periodId);
  const exams = await prisma.exam.count({ where: { periodId } });
  if (exams > 0) throw conflict("אי אפשר למחוק תקופה שיש בה מבחנים. יש להעביר או למחוק אותם קודם.", { exams });
  await prisma.gradePeriod.delete({ where: { id: periodId } });
}

// ================= מבחנים =================

const examInclude = {
  period: { select: { id: true, name: true, assignmentId: true } },
  grades: { select: { score: true } },
} as const;

type ExamWithRelations = Prisma.ExamGetPayload<{ include: typeof examInclude }>;

function serializeExam(exam: ExamWithRelations) {
  const scores = exam.grades.map((g) => scoreToNumber(g.score)!);
  return {
    id: exam.id,
    title: exam.title,
    date: formatDateOnly(exam.date),
    weight: exam.weight,
    description: exam.description,
    period: { id: exam.period.id, name: exam.period.name },
    assignmentId: exam.period.assignmentId,
    gradesCount: scores.length,
    average: scores.length ? round1(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
  };
}

export async function listExams(auth: AuthUser, assignmentId: number, q: z.infer<typeof listExamsQuery>) {
  await getManageableAssignment(auth, assignmentId);
  const dateFilter: Prisma.DateTimeFilter = {};
  if (q.from) dateFilter.gte = toDateOnly(q.from);
  if (q.to) dateFilter.lte = toDateOnly(q.to);
  const exams = await prisma.exam.findMany({
    where: {
      period: { assignmentId },
      ...(q.periodId ? { periodId: q.periodId } : {}),
      ...(q.from || q.to ? { date: dateFilter } : {}),
      ...(q.search ? { title: { contains: q.search, mode: "insensitive" } } : {}),
    },
    include: examInclude,
    orderBy: [{ [q.sortBy]: q.order }, { id: "asc" }],
  });
  return exams.map(serializeExam);
}

export async function getExam(auth: AuthUser, examId: number) {
  await getManageableExam(auth, examId);
  return serializeExam(await prisma.exam.findUniqueOrThrow({ where: { id: examId }, include: examInclude }));
}

async function assertExamWeight(periodId: number, weight: number, excludeExamId?: number) {
  const others = await prisma.exam.findMany({
    where: { periodId, ...(excludeExamId ? { id: { not: excludeExamId } } : {}) },
    select: { weight: true },
  });
  const total = sumWeights(others) + weight;
  if (total > 100) {
    throw businessRule("WEIGHT_EXCEEDED", `סכום משקלי המבחנים בתקופה יהיה ${total}%, המקסימום הוא 100%`, {
      currentTotal: total - weight,
      maxAllowed: 100 - (total - weight),
    });
  }
}

export async function createExam(auth: AuthUser, periodId: number, data: z.infer<typeof createExamSchema>) {
  await getManageablePeriod(auth, periodId);
  await assertExamWeight(periodId, data.weight);
  const exam = await prisma.exam.create({
    data: { periodId, title: data.title, date: toDateOnly(data.date), weight: data.weight, description: data.description ?? null },
    include: examInclude,
  });
  return serializeExam(exam);
}

export async function updateExam(auth: AuthUser, examId: number, data: z.infer<typeof updateExamSchema>) {
  const { exam } = await getManageableExam(auth, examId);
  const targetPeriodId = data.periodId ?? exam.periodId;
  if (data.periodId && data.periodId !== exam.periodId) {
    // מעבר לתקופה אחרת - רק בתוך אותו שיבוץ
    const target = await prisma.gradePeriod.findUnique({ where: { id: data.periodId } });
    if (!target || target.assignmentId !== exam.period.assignmentId) {
      throw badRequest("התקופה שנבחרה לא שייכת לשיבוץ זה", [{ field: "periodId", message: "תקופה לא תקינה" }]);
    }
  }
  if (data.weight !== undefined || data.periodId !== undefined) {
    await assertExamWeight(targetPeriodId, data.weight ?? exam.weight, examId);
  }
  const updated = await prisma.exam.update({
    where: { id: examId },
    data: {
      title: data.title,
      date: data.date ? toDateOnly(data.date) : undefined,
      weight: data.weight,
      description: data.description,
      periodId: data.periodId,
    },
    include: examInclude,
  });
  return serializeExam(updated);
}

export async function deleteExam(auth: AuthUser, examId: number) {
  await getManageableExam(auth, examId);
  await prisma.exam.delete({ where: { id: examId } }); // הציונים נמחקים יחד איתו
}

// ================= ציונים =================

async function examGradesList(examId: number, classId: number) {
  const [exam, students, grades] = await Promise.all([
    prisma.exam.findUniqueOrThrow({ where: { id: examId }, include: examInclude }),
    prisma.user.findMany({
      where: { classId, role: "STUDENT", isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.grade.findMany({ where: { examId } }),
  ]);
  const byStudent = new Map(grades.map((g) => [g.studentId, g]));
  return {
    exam: serializeExam(exam),
    items: students.map((s) => {
      const grade = byStudent.get(s.id);
      return {
        student: personSummary(s),
        score: scoreToNumber(grade?.score),
        evaluation: grade?.evaluation ?? null,
      };
    }),
  };
}

export async function getExamGrades(auth: AuthUser, examId: number) {
  const { assignment } = await getManageableExam(auth, examId);
  return examGradesList(examId, assignment.classId);
}

export async function saveExamGrades(auth: AuthUser, examId: number, data: z.infer<typeof saveGradesSchema>) {
  const { assignment } = await getManageableExam(auth, examId);

  // כל התלמידות חייבות להיות תלמידות פעילות בכיתה של המבחן
  const ids = data.grades.map((g) => g.studentId);
  const valid = await prisma.user.findMany({
    where: { id: { in: ids }, classId: assignment.classId, role: "STUDENT", isActive: true },
    select: { id: true },
  });
  const validIds = new Set(valid.map((v) => v.id));
  const invalid = ids.filter((id) => !validIds.has(id));
  if (invalid.length > 0) {
    throw badRequest(
      "חלק מהתלמידות אינן בכיתה של המבחן",
      invalid.map((id) => ({ field: "grades.studentId", message: `תלמידה ${id} לא שייכת לכיתה` })),
    );
  }

  await prisma.$transaction(
    data.grades.map((g) =>
      g.score === null
        ? prisma.grade.deleteMany({ where: { examId, studentId: g.studentId } })
        : prisma.grade.upsert({
            where: { examId_studentId: { examId, studentId: g.studentId } },
            create: { examId, studentId: g.studentId, score: g.score, evaluation: g.evaluation ?? null },
            update: { score: g.score, ...(g.evaluation !== undefined ? { evaluation: g.evaluation } : {}) },
          }),
    ),
  );
  return examGradesList(examId, assignment.classId);
}

// ================= ציונים סופיים =================

/** טוען את כל מה שצריך לחישוב ציונים של שיבוץ */
export async function loadGradebook(assignmentId: number, studentIds?: number[]) {
  const assignment = await prisma.teachingAssignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: { class: true, subject: true, teacher: { select: { id: true, firstName: true, lastName: true } } },
  });
  const periods = await prisma.gradePeriod.findMany({
    where: { assignmentId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: { exams: { orderBy: [{ date: "asc" }, { id: "asc" }] } },
  });
  const students = await prisma.user.findMany({
    where: { classId: assignment.classId, role: "STUDENT", isActive: true, ...(studentIds ? { id: { in: studentIds } } : {}) },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });
  const grades = await prisma.grade.findMany({
    where: { exam: { period: { assignmentId } }, studentId: { in: students.map((s) => s.id) } },
  });
  return { assignment, periods, students, grades };
}

export type Gradebook = Awaited<ReturnType<typeof loadGradebook>>;

/** מחשב לכל תלמידה ציון לכל מבחן, ציון תקופה וציון שנתי */
export function computeGradebook(book: Gradebook) {
  const status = assignmentStatus(book.periods);
  const gradesByStudent = new Map<number, Map<number, { score: number; evaluation: string | null }>>();
  for (const g of book.grades) {
    const map = gradesByStudent.get(g.studentId) ?? new Map();
    map.set(g.examId, { score: scoreToNumber(g.score)!, evaluation: g.evaluation });
    gradesByStudent.set(g.studentId, map);
  }

  const students = book.students.map((s) => {
    const own = gradesByStudent.get(s.id) ?? new Map();
    const scores = new Map([...own].map(([examId, v]) => [examId, v.score]));
    const { periodGrades, annualGrade } = studentGrades(book.periods, scores);
    const examScores: Record<string, number | null> = {};
    const evaluations: Record<string, string | null> = {};
    for (const p of book.periods) {
      for (const e of p.exams) {
        examScores[String(e.id)] = own.get(e.id)?.score ?? null;
        evaluations[String(e.id)] = own.get(e.id)?.evaluation ?? null;
      }
    }
    return {
      studentId: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      scores: examScores,
      evaluations,
      periodGrades,
      annualGrade,
    };
  });

  return {
    assignment: {
      id: book.assignment.id,
      class: classSummary(book.assignment.class),
      subject: subjectSummary(book.assignment.subject),
      teacher: personSummary(book.assignment.teacher),
    },
    periods: status.periods.map((p) => ({
      ...p,
      exams: book.periods
        .find((bp) => bp.id === p.id)!
        .exams.map((e) => ({ id: e.id, title: e.title, date: formatDateOnly(e.date), weight: e.weight })),
    })),
    periodsWeight: status.periodsWeight,
    canCalculateAnnual: status.canCalculateAnnual,
    problems: status.problems,
    students,
  };
}

export async function getFinalGrades(auth: AuthUser, assignmentId: number, q: z.infer<typeof finalGradesQuery>) {
  await getManageableAssignment(auth, assignmentId);
  const result = computeGradebook(await loadGradebook(assignmentId));
  const dir = q.order === "asc" ? 1 : -1;
  result.students.sort((a, b) => {
    if (q.sortBy === "annual") {
      // תלמידות בלי ציון שנתי תמיד בסוף
      if (a.annualGrade === null && b.annualGrade === null) return a.lastName.localeCompare(b.lastName, "he");
      if (a.annualGrade === null) return 1;
      if (b.annualGrade === null) return -1;
      return (a.annualGrade - b.annualGrade) * dir;
    }
    const key = q.sortBy;
    const other = key === "lastName" ? "firstName" : "lastName";
    return (a[key].localeCompare(b[key], "he") || a[other].localeCompare(b[other], "he")) * dir;
  });
  return result;
}

/**
 * שמירת טבלת ציונים שלמה (תלמידות × מבחנים) של שיבוץ, בבקשה אחת.
 * שולחים רק את התאים שהשתנו. מחזיר את הטבלה המעודכנת, כמו final-grades.
 */
export async function saveGradebook(auth: AuthUser, assignmentId: number, data: z.infer<typeof saveGradebookSchema>) {
  const assignment = await getManageableAssignment(auth, assignmentId);

  const examIds = [...new Set(data.grades.map((g) => g.examId))];
  const validExams = await prisma.exam.findMany({
    where: { id: { in: examIds }, period: { assignmentId } },
    select: { id: true },
  });
  const validExamIds = new Set(validExams.map((e) => e.id));

  const studentIds = [...new Set(data.grades.map((g) => g.studentId))];
  const validStudents = await prisma.user.findMany({
    where: { id: { in: studentIds }, classId: assignment.classId, role: "STUDENT", isActive: true },
    select: { id: true },
  });
  const validStudentIds = new Set(validStudents.map((s) => s.id));

  const problems = [
    ...examIds.filter((id) => !validExamIds.has(id)).map((id) => ({ field: "grades.examId", message: `מבחן ${id} לא שייך לשיבוץ זה` })),
    ...studentIds
      .filter((id) => !validStudentIds.has(id))
      .map((id) => ({ field: "grades.studentId", message: `תלמידה ${id} לא שייכת לכיתה` })),
  ];
  if (problems.length > 0) throw badRequest("חלק מהציונים אינם שייכים לשיבוץ זה", problems);

  await prisma.$transaction(
    data.grades.map((g) =>
      g.score === null
        ? prisma.grade.deleteMany({ where: { examId: g.examId, studentId: g.studentId } })
        : prisma.grade.upsert({
            where: { examId_studentId: { examId: g.examId, studentId: g.studentId } },
            create: { examId: g.examId, studentId: g.studentId, score: g.score, evaluation: g.evaluation ?? null },
            update: { score: g.score, ...(g.evaluation !== undefined ? { evaluation: g.evaluation } : {}) },
          }),
    ),
  );

  return getFinalGrades(auth, assignmentId, { sortBy: "lastName", order: "asc" });
}
