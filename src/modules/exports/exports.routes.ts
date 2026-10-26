import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import * as controller from "./exports.controller.js";

/** ייצוא קבצי CSV שנפתחים באקסל */
export const exportsRouter = Router();

exportsRouter.use(requireAuth);

exportsRouter.get("/students.csv", requireRole("PRINCIPAL", "TEACHER"), controller.students);
exportsRouter.get("/teachers.csv", requireRole("PRINCIPAL"), controller.teachers);
exportsRouter.get("/grades.csv", requireRole("PRINCIPAL", "TEACHER"), controller.grades);
