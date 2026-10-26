import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import * as controller from "./schedule.controller.js";

export const scheduleRouter = Router();

scheduleRouter.use(["/schedule", "/lessons"], requireAuth);

scheduleRouter.get("/schedule/me", controller.mySchedule);
scheduleRouter.get("/schedule/teachers/:id", requireRole("PRINCIPAL"), controller.teacherSchedule);

// ניהול שיעורים: מנהלת - כל שיבוץ, מורה - רק השיבוצים שלה
scheduleRouter.post("/lessons", requireRole("PRINCIPAL", "TEACHER"), controller.createLesson);
scheduleRouter.patch("/lessons/:id", requireRole("PRINCIPAL", "TEACHER"), controller.updateLesson);
scheduleRouter.delete("/lessons/:id", requireRole("PRINCIPAL", "TEACHER"), controller.deleteLesson);
