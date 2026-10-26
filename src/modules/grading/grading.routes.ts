import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import * as controller from "./grading.controller.js";

/**
 * תקופות ציון, מבחנים וציונים.
 * מנהלת - בכל השיבוצים בבית הספר. מורה - רק בשיבוצים שלה (נבדק בשירות).
 */
export const gradingRouter = Router();

gradingRouter.use(
  ["/assignments/:id/periods", "/assignments/:id/exams", "/assignments/:id/final-grades", "/assignments/:id/grades", "/periods", "/exams"],
  requireAuth,
  requireRole("PRINCIPAL", "TEACHER"),
);

gradingRouter.get("/assignments/:id/periods", controller.listPeriods);
gradingRouter.post("/assignments/:id/periods", controller.createPeriod);
gradingRouter.patch("/periods/:id", controller.updatePeriod);
gradingRouter.delete("/periods/:id", controller.deletePeriod);

gradingRouter.get("/assignments/:id/exams", controller.listExams);
gradingRouter.post("/periods/:id/exams", controller.createExam);
gradingRouter.get("/exams/:id", controller.getExam);
gradingRouter.patch("/exams/:id", controller.updateExam);
gradingRouter.delete("/exams/:id", controller.deleteExam);

gradingRouter.get("/exams/:id/grades", controller.getExamGrades);
gradingRouter.put("/exams/:id/grades", controller.saveExamGrades);

gradingRouter.get("/assignments/:id/final-grades", controller.finalGrades);
// שמירת כל טבלת הציונים של השיבוץ בבקשה אחת
gradingRouter.put("/assignments/:id/grades", controller.saveGradebook);
