import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import * as controller from "./me.controller.js";

/** אזור התלמידה: רק התלמידה המחוברת, ורק המידע שלה עצמה */
export const meRouter = Router();

meRouter.use(requireAuth, requireRole("STUDENT"));

meRouter.get("/grades", controller.grades);
meRouter.get("/attendance", controller.attendance);
