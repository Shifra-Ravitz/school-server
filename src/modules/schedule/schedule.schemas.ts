import { z } from "zod";
import { idParam, optionalText } from "../../utils/validation.js";

const dayOfWeek = z
  .number({ message: "יום חייב להיות מספר" })
  .int()
  .min(1, { message: "יום בין 1 (ראשון) ל־6 (שישי)" })
  .max(6, { message: "יום בין 1 (ראשון) ל־6 (שישי)" });

const lessonNumber = z
  .number({ message: "שעה חייבת להיות מספר" })
  .int()
  .min(1, { message: "שעה בין 1 ל־10" })
  .max(10, { message: "שעה בין 1 ל־10" });

export const createLessonSchema = z.object({
  assignmentId: idParam,
  dayOfWeek,
  lessonNumber,
  room: optionalText(30),
});

export const updateLessonSchema = z
  .object({
    assignmentId: idParam.optional(),
    dayOfWeek: dayOfWeek.optional(),
    lessonNumber: lessonNumber.optional(),
    room: optionalText(30),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "לא נשלחו שדות לעדכון" });
