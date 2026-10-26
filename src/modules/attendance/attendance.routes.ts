import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import * as controller from "./attendance.controller.js";

/** נוכחות: מנהלת - בכל השיבוצים, מורה - רק בשיבוצים שלה */
export const attendanceRouter = Router();

attendanceRouter.use(["/assignments/:id/attendance", "/attendance"], requireAuth, requireRole("PRINCIPAL", "TEACHER"));

attendanceRouter.get("/assignments/:id/attendance", controller.list);
attendanceRouter.get("/assignments/:id/attendance/lesson", controller.lessonRoster);
attendanceRouter.put("/assignments/:id/attendance", controller.saveLesson);
attendanceRouter.patch("/attendance/:id", controller.update);
attendanceRouter.delete("/attendance/:id", controller.remove);
