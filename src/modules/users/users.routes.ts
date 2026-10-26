import { Router } from "express";
import multer from "multer";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { AppError } from "../../utils/errors.js";
import * as controller from "./users.controller.js";

/** העלאת קובץ אקסל לזיכרון (עד 2MB) */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith(".xlsx")) cb(null, true);
    else cb(new AppError(400, "INVALID_FILE", "יש להעלות קובץ אקסל מסוג xlsx"));
  },
});

export const usersRouter = Router();

// כל הפעולות על משתמשות - למנהלת בלבד
usersRouter.use(requireAuth, requireRole("PRINCIPAL"));

usersRouter.get("/", controller.list);
usersRouter.post("/", controller.create);
usersRouter.get("/import/template.xlsx", controller.importTemplate);
usersRouter.post("/import", upload.single("file"), controller.importStudents);
usersRouter.get("/import/:importId/passwords.xlsx", controller.importPasswords);
usersRouter.get("/:id", controller.getOne);
usersRouter.patch("/:id", controller.update);
usersRouter.post("/:id/reset-password", controller.resetPassword);
