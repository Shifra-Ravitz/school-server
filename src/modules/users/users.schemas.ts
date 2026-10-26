import { z } from "zod";
import {
  dateString,
  emailField,
  idNumberField,
  idParam,
  optionalText,
  passwordField,
  requiredText,
  searchText,
  sortOrder,
} from "../../utils/validation.js";
import { todayInIsrael } from "../../utils/dates.js";

const phoneField = z
  .string()
  .trim()
  .regex(/^[0-9+\-\s]{7,20}$/, { message: "מספר טלפון לא תקין" })
  .nullish()
  .or(z.literal("").transform(() => null));

const birthDateField = dateString.refine((d) => d <= todayInIsrael(), { message: "תאריך לידה לא יכול להיות בעתיד" });

export const listUsersQuery = z.object({
  role: z.enum(["PRINCIPAL", "TEACHER", "STUDENT"], { message: "role חייב להיות PRINCIPAL, TEACHER או STUDENT" }).optional(),
  classId: idParam.optional(),
  firstName: searchText,
  lastName: searchText,
  search: searchText,
  isActive: z
    .enum(["true", "false", "all"], { message: "isActive חייב להיות true, false או all" })
    .default("true"),
  sortBy: z.enum(["firstName", "lastName", "createdAt"], { message: "sortBy לא תקין" }).default("lastName"),
  order: sortOrder,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const baseUserFields = {
  firstName: requiredText(2, 40),
  lastName: requiredText(2, 40),
  email: emailField,
  idNumber: idNumberField.nullish(),
  phone: phoneField.optional(),
  address: optionalText(200),
  birthDate: birthDateField.nullish(),
  classId: idParam.nullish(),
};

export const createUserSchema = z
  .object({
    role: z.enum(["TEACHER", "STUDENT"], { message: "role חייב להיות TEACHER או STUDENT" }),
    ...baseUserFields,
    // אם לא נשלחה סיסמה - השרת יוצר סיסמה אקראית ומחזיר אותה פעם אחת
    password: passwordField.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "STUDENT") {
      if (!data.classId) ctx.addIssue({ code: "custom", path: ["classId"], message: "לתלמידה חובה לבחור כיתה" });
      if (!data.birthDate) ctx.addIssue({ code: "custom", path: ["birthDate"], message: "לתלמידה חובה תאריך לידה" });
      if (!data.idNumber) ctx.addIssue({ code: "custom", path: ["idNumber"], message: "לתלמידה חובה תעודת זהות" });
    }
    if (data.role === "TEACHER" && data.classId) {
      ctx.addIssue({ code: "custom", path: ["classId"], message: "למורה לא משייכים כיתה (משבצים אותה דרך שיבוצים)" });
    }
  });

export const updateUserSchema = z
  .object({
    firstName: baseUserFields.firstName.optional(),
    lastName: baseUserFields.lastName.optional(),
    email: baseUserFields.email.optional(),
    idNumber: baseUserFields.idNumber,
    phone: baseUserFields.phone,
    address: baseUserFields.address,
    birthDate: baseUserFields.birthDate,
    classId: baseUserFields.classId,
    isActive: z.boolean({ message: "isActive חייב להיות true או false" }).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "לא נשלחו שדות לעדכון" });

export const resetPasswordSchema = z.object({
  password: passwordField.optional(),
});

