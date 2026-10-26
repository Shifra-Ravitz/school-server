import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import * as controller from "./classes.controller.js";
import { classSchedule } from "../schedule/schedule.controller.js";

export const classesRouter = Router();

classesRouter.use(requireAuth);

// צפייה: מנהלת (כל הכיתות) ומורה (רק הכיתות שהיא מלמדת בהן)
classesRouter.get("/", requireRole("PRINCIPAL", "TEACHER"), controller.list);
classesRouter.get("/:id", requireRole("PRINCIPAL", "TEACHER"), controller.getOne);
classesRouter.get("/:id/students", requireRole("PRINCIPAL", "TEACHER"), controller.students);
classesRouter.get("/:id/schedule", requireRole("PRINCIPAL", "TEACHER"), classSchedule);

// ניהול: מנהלת בלבד
classesRouter.post("/", requireRole("PRINCIPAL"), controller.create);
classesRouter.patch("/:id", requireRole("PRINCIPAL"), controller.update);
classesRouter.delete("/:id", requireRole("PRINCIPAL"), controller.remove);
