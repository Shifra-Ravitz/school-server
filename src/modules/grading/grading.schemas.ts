import { z } from "zod";
import { dateString, idParam, optionalText, requiredText, searchText, sortOrder } from "../../utils/validation.js";

const periodWeight = z
  .number({ message: "משקל חייב להיות מספר" })
  .int({ message: "משקל חייב להיות מספר שלם" })
  .min(0, { message: "משקל בין 0 ל־100" })
  .max(100, { message: "משקל בין 0 ל־100" });

const examWeight = z
  .number({ message: "משקל חייב להיות מספר" })
  .int({ message: "משקל חייב להיות מספר שלם" })
  .min(1, { message: "משקל בין 1 ל־100" })
  .max(100, { message: "משקל בין 1 ל־100" });

export const createPeriodSchema = z.object({
  name: requiredText(2, 30),
  weight: periodWeight,
  sortOrder: z.number().int().min(0).max(100).optional(),
});

export const updatePeriodSchema = z
  .object({
    name: requiredText(2, 30).optional(),
    weight: periodWeight.optional(),
    sortOrder: z.number().int().min(0).max(100).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "לא נשלחו שדות לעדכון" });

export const listExamsQuery = z
  .object({
    periodId: idParam.optional(),
    from: dateString.optional(),
    to: dateString.optional(),
    search: searchText,
    sortBy: z.enum(["date", "title", "weight"], { message: "sortBy לא תקין" }).default("date"),
    order: sortOrder,
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: "תאריך ההתחלה אחרי תאריך הסיום", path: ["from"] });

export const createExamSchema = z.object({
  title: requiredText(2, 80),
  date: dateString,
  weight: examWeight,
  description: optionalText(500),
});

export const updateExamSchema = z
  .object({
    title: requiredText(2, 80).optional(),
    date: dateString.optional(),
    weight: examWeight.optional(),
    description: optionalText(500),
    periodId: idParam.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "לא נשלחו שדות לעדכון" });

/** ציון בין 0 ל־100 עם עד שתי ספרות אחרי הנקודה (למשל 98.5 או 99.25) */
export const scoreField = z
  .number({ message: "ציון חייב להיות מספר" })
  .min(0, { message: "ציון בין 0 ל־100" })
  .max(100, { message: "ציון בין 0 ל־100" })
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, { message: "עד שתי ספרות אחרי הנקודה" });

export const saveGradesSchema = z
  .object({
    grades: z
      .array(
        z
          .object({
            studentId: idParam,
            // null = מחיקת הציון
            score: scoreField.nullable(),
            // לא נשלח = ההערכה הקיימת נשמרת. null או "" = מחיקת ההערכה
            evaluation: optionalText(500),
          })
          .refine((g) => !(g.score === null && g.evaluation), {
            message: "אי אפשר לשמור הערכה בלי ציון",
            path: ["evaluation"],
          }),
        { message: "grades חייב להיות רשימה" },
      )
      .min(1, { message: "יש לשלוח לפחות ציון אחד" })
      .max(300),
  })
  .refine((d) => new Set(d.grades.map((g) => g.studentId)).size === d.grades.length, {
    message: "אותה תלמידה מופיעה יותר מפעם אחת",
    path: ["grades"],
  });

export const finalGradesQuery = z.object({
  sortBy: z.enum(["lastName", "firstName", "annual"], { message: "sortBy לא תקין" }).default("lastName"),
  order: sortOrder,
});

/** שמירת טבלת ציונים שלמה של שיבוץ: כמה מבחנים וכמה תלמידות בבקשה אחת */
export const saveGradebookSchema = z
  .object({
    grades: z
      .array(
        z
          .object({
            examId: idParam,
            studentId: idParam,
            // null = מחיקת הציון
            score: scoreField.nullable(),
            // לא נשלח = ההערכה הקיימת נשמרת. null או "" = מחיקת ההערכה
            evaluation: optionalText(500),
          })
          .refine((g) => !(g.score === null && g.evaluation), {
            message: "אי אפשר לשמור הערכה בלי ציון",
            path: ["evaluation"],
          }),
        { message: "grades חייב להיות רשימה" },
      )
      .min(1, { message: "יש לשלוח לפחות ציון אחד" })
      .max(5000),
  })
  .refine((d) => new Set(d.grades.map((g) => `${g.examId}|${g.studentId}`)).size === d.grades.length, {
    message: "אותו ציון (מבחן + תלמידה) מופיע יותר מפעם אחת",
    path: ["grades"],
  });
