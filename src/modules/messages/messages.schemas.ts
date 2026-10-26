import { z } from "zod";
import { idParam, queryBoolean, requiredText } from "../../utils/validation.js";

export const sendMessageSchema = z
  .object({
    title: requiredText(2, 100),
    body: requiredText(1, 2000),
    audience: z.enum(["ALL", "TEACHERS", "STUDENTS", "CLASS"], {
      message: "audience חייב להיות ALL, TEACHERS, STUDENTS או CLASS",
    }),
    classId: idParam.nullish(),
  })
  .superRefine((d, ctx) => {
    if (d.audience === "CLASS" && !d.classId) {
      ctx.addIssue({ code: "custom", path: ["classId"], message: "יש לבחור כיתה" });
    }
  });

export const inboxQuery = z.object({
  unread: queryBoolean.optional(),
});
