import { z } from "zod";
import { idParam, searchText, sortOrder } from "../../utils/validation.js";

const gradeLevel = z.coerce
  .number({ message: "שכבה חייבת להיות מספר" })
  .int()
  .min(1, { message: "שכבה בין 1 ל־12" })
  .max(12, { message: "שכבה בין 1 ל־12" });
const parallel = z.coerce
  .number({ message: "מספר כיתה חייב להיות מספר" })
  .int()
  .min(1, { message: "מספר כיתה בין 1 ל־10" })
  .max(10, { message: "מספר כיתה בין 1 ל־10" });
const schoolYear = z.string().trim().min(2).max(10);

export const listClassesQuery = z.object({
  gradeLevel: gradeLevel.optional(),
  schoolYear: schoolYear.optional(),
});

export const createClassSchema = z.object({
  gradeLevel,
  parallel,
  // אם לא נשלח - שנת הלימודים הנוכחית
  schoolYear: schoolYear.optional(),
});

export const updateClassSchema = z
  .object({ gradeLevel: gradeLevel.optional(), parallel: parallel.optional(), schoolYear: schoolYear.optional() })
  .refine((d) => Object.keys(d).length > 0, { message: "לא נשלחו שדות לעדכון" });

export const classStudentsQuery = z.object({
  firstName: searchText,
  lastName: searchText,
  search: searchText,
  sortBy: z.enum(["firstName", "lastName"], { message: "sortBy לא תקין" }).default("lastName"),
  order: sortOrder,
});

export const classIdParams = z.object({ id: idParam });
