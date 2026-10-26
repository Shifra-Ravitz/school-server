import { z } from "zod";
import { emailField, passwordField } from "../../utils/validation.js";

export const loginSchema = z.object({
  email: emailField,
  password: z.string({ message: "שדה חובה" }).min(1, { message: "שדה חובה" }),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string({ message: "שדה חובה" }).min(1, { message: "שדה חובה" }),
    newPassword: passwordField,
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "הסיסמה החדשה חייבת להיות שונה מהנוכחית",
    path: ["newPassword"],
  });
