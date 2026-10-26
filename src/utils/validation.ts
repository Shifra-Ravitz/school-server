import { z } from "zod";
import { badRequest } from "./errors.js";

/**
 * בודק נתונים מול סכמת Zod.
 * אם יש שגיאה - זורק 400 עם רשימת השדות הבעייתיים.
 */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join(".") || null,
      message: issue.message,
    }));
    throw badRequest("הנתונים שנשלחו אינם תקינים", details);
  }
  return result.data;
}

// ---- רכיבי סכמה שחוזרים בהרבה מקומות ----

/** מזהה מספרי מתוך הכתובת, למשל /classes/5 */
export const idParam = z.coerce.number().int().positive({ message: "מזהה לא תקין" });

export const idParams = z.object({ id: idParam });

/** תאריך בפורמט YYYY-MM-DD */
export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "תאריך חייב להיות בפורמט YYYY-MM-DD", abort: true })
  .refine(
    (v) => {
      const d = new Date(`${v}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
    },
    { message: "תאריך לא קיים" },
  );

/** טקסט חובה: מוריד רווחים מיותרים ובודק אורך */
export const requiredText = (min: number, max: number) =>
  z
    .string({ message: "שדה חובה" })
    .trim()
    .min(min, { message: `לפחות ${min} תווים` })
    .max(max, { message: `עד ${max} תווים` });

/** טקסט רשות: מחרוזת ריקה הופכת ל־null */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: `עד ${max} תווים` })
    .nullish()
    .transform((v) => (v === undefined ? undefined : v === null || v === "" ? null : v));

export const emailField = z
  .string({ message: "שדה חובה" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "כתובת מייל לא תקינה" }));

export const passwordField = z
  .string({ message: "שדה חובה" })
  .min(6, { message: "סיסמה חייבת להכיל לפחות 6 תווים" })
  .max(72, { message: "סיסמה ארוכה מדי" });

/** ערך בוליאני מתוך כתובת: ?isActive=true */
export const queryBoolean = z
  .enum(["true", "false"], { message: "ערך חייב להיות true או false" })
  .transform((v) => v === "true");

export const sortOrder = z.enum(["asc", "desc"], { message: "order חייב להיות asc או desc" }).default("asc");

/** מחרוזת חיפוש רשות */
export const searchText = z.string().trim().max(50).optional().transform((v) => (v ? v : undefined));

/**
 * בדיקת תקינות של מספר תעודת זהות ישראלית (ספרת ביקורת).
 * מקבל 5-9 ספרות, משלים אפסים מימין ל־9 ספרות.
 */
export function isValidIsraeliId(value: string): boolean {
  if (!/^\d{5,9}$/.test(value)) return false;
  const id = value.padStart(9, "0");
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let digit = Number(id[i]) * ((i % 2) + 1);
    if (digit > 9) digit -= 9;
    sum += digit;
  }
  return sum % 10 === 0;
}

/** תעודת זהות: 9 ספרות (משלים אפסים מובילים) עם ספרת ביקורת תקינה */
export const idNumberField = z
  .string({ message: "שדה חובה" })
  .trim()
  .regex(/^\d{5,9}$/, { message: "תעודת זהות חייבת להכיל עד 9 ספרות", abort: true })
  .refine(isValidIsraeliId, { message: "מספר תעודת זהות לא תקין" })
  .transform((v) => v.padStart(9, "0"));
