/**
 * חישוב ציוני תקופה וציון שנתי.
 *
 * הכללים שסוכמו באפיון:
 * 1. ציון תקופה מחושב רק כשמשקלי המבחנים בה מגיעים בדיוק ל־100%.
 * 2. ציון שנתי מחושב רק כשמשקלי התקופות מגיעים בדיוק ל־100%,
 *    וכל תקופה שמשקלה גדול מ־0 הושלמה.
 * 3. תקופה שמשקלה 0% לא נכנסת לציון השנתי (למשל קורס של מחצית אחת).
 * 4. מבחן שאין בו ציון לתלמידה נחשב 0.
 * 5. ציונים מחושבים מעוגלים לספרה אחת אחרי הנקודה.
 *
 * דוגמה: מבחן 30% (80) + עבודה 20% (90) + מבחן מחצית 50% (70)
 *        ציון התקופה = (80×30 + 90×20 + 70×50) / 100 = 77
 */

export interface CalcExam {
  id: number;
  weight: number;
}

export interface CalcPeriod {
  id: number;
  name: string;
  weight: number;
  sortOrder: number;
  exams: CalcExam[];
}

export interface PeriodStatus {
  id: number;
  name: string;
  weight: number;
  sortOrder: number;
  examsCount: number;
  examsWeight: number;
  isComplete: boolean;
}

export interface AssignmentStatus {
  periods: PeriodStatus[];
  periodsWeight: number;
  canCalculateAnnual: boolean;
  problems: string[];
}

export function round1(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function sumWeights(items: Array<{ weight: number }>): number {
  return items.reduce((sum, i) => sum + i.weight, 0);
}

/** מצב ההגדרות של שיבוץ: האם אפשר לחשב ציונים, ומה חסר */
export function assignmentStatus(periods: CalcPeriod[]): AssignmentStatus {
  const sorted = [...periods].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const statuses = sorted.map((p) => {
    const examsWeight = sumWeights(p.exams);
    return {
      id: p.id,
      name: p.name,
      weight: p.weight,
      sortOrder: p.sortOrder,
      examsCount: p.exams.length,
      examsWeight,
      isComplete: examsWeight === 100,
    };
  });
  const periodsWeight = sumWeights(sorted);
  const problems: string[] = [];
  if (periodsWeight !== 100) problems.push(`משקלי התקופות מסתכמים ב־${periodsWeight}% ולא ב־100%`);
  for (const p of statuses) {
    if (p.weight > 0 && !p.isComplete) {
      problems.push(
        p.examsCount === 0 ? `ב${p.name} עדיין לא הוגדרו מבחנים` : `ב${p.name} הוגדרו רק ${p.examsWeight}% מהמבחנים`,
      );
    }
  }
  return { periods: statuses, periodsWeight, canCalculateAnnual: problems.length === 0, problems };
}

/**
 * ציוני תלמידה אחת.
 * scores: מזהה מבחן → ציון (מבחן שאינו ברשימה נחשב 0).
 */
export function studentGrades(periods: CalcPeriod[], scores: Map<number, number>) {
  const status = assignmentStatus(periods);
  const exact = new Map<number, number | null>();

  for (const period of periods) {
    const complete = status.periods.find((p) => p.id === period.id)!.isComplete;
    if (!complete) {
      exact.set(period.id, null);
      continue;
    }
    const total = period.exams.reduce((sum, exam) => sum + (scores.get(exam.id) ?? 0) * exam.weight, 0);
    exact.set(period.id, total / 100);
  }

  let annualGrade: number | null = null;
  if (status.canCalculateAnnual) {
    let total = 0;
    for (const period of periods) if (period.weight > 0) total += (exact.get(period.id) ?? 0) * period.weight;
    annualGrade = round1(total / 100);
  }

  const periodGrades: Record<string, number | null> = {};
  for (const [id, value] of exact) periodGrades[String(id)] = value === null ? null : round1(value);
  return { periodGrades, annualGrade };
}
