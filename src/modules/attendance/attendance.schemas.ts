import { z } from "zod";
import { todayInIsrael } from "../../utils/dates.js";
import { dateString, idParam, optionalText, queryBoolean, searchText, sortOrder } from "../../utils/validation.js";

export const statusField = z.enum(["LATE", "ABSENT", "RELEASED"], {
  message: "status חייב להיות LATE (איחור), ABSENT (חיסור) או RELEASED (שחרור)",
});

const lessonNumber = z.coerce
  .number({ message: "שעה חייבת להיות מספר" })
  .int()
  .min(1, { message: "שעה בין 1 ל־10" })
  .max(10, { message: "שעה בין 1 ל־10" });

const pastOrToday = dateString.refine((d) => d <= todayInIsrael(), { message: "אי אפשר לרשום נוכחות לתאריך עתידי" });

export const listAttendanceQuery = z
  .object({
    date: dateString.optional(),
    lessonNumber: lessonNumber.optional(),
    from: dateString.optional(),
    to: dateString.optional(),
    status: statusField.optional(),
    approved: queryBoolean.optional(),
    studentId: idParam.optional(),
    firstName: searchText,
    lastName: searchText,
    search: searchText,
    order: sortOrder.default("desc"),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: "תאריך ההתחלה אחרי תאריך הסיום", path: ["from"] });

export const lessonRosterQuery = z.object({
  date: pastOrToday,
  lessonNumber,
});

export const saveLessonAttendanceSchema = z
  .object({
    date: pastOrToday,
    lessonNumber,
    // רק חריגות. תלמידה שלא נשלחה נחשבת נוכחת.
    records: z
      .array(
        z.object({
          studentId: idParam,
          status: statusField,
          approved: z.boolean({ message: "approved חייב להיות true או false" }).optional(),
          reason: optionalText(200),
        }),
        { message: "records חייב להיות רשימה" },
      )
      .max(100),
  })
  .refine((d) => new Set(d.records.map((r) => r.studentId)).size === d.records.length, {
    message: "אותה תלמידה מופיעה יותר מפעם אחת",
    path: ["records"],
  });

export const updateAttendanceSchema = z
  .object({
    status: statusField.optional(),
    approved: z.boolean({ message: "approved חייב להיות true או false" }).optional(),
    reason: optionalText(200),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "לא נשלחו שדות לעדכון" });

export const myAttendanceQuery = z
  .object({
    status: statusField.optional(),
    approved: queryBoolean.optional(),
    subjectId: idParam.optional(),
    from: dateString.optional(),
    to: dateString.optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: "תאריך ההתחלה אחרי תאריך הסיום", path: ["from"] });
