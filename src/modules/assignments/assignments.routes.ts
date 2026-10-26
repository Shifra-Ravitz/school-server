import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import * as controller from "./assignments.controller.js";

export const assignmentsRouter = Router();

assignmentsRouter.use(requireAuth);

assignmentsRouter.get("/", requireRole("PRINCIPAL", "TEACHER"), controller.list);
assignmentsRouter.get("/:id", requireRole("PRINCIPAL", "TEACHER"), controller.getOne);
assignmentsRouter.post("/", requireRole("PRINCIPAL"), controller.create);
assignmentsRouter.patch("/:id", requireRole("PRINCIPAL"), controller.update);
assignmentsRouter.delete("/:id", requireRole("PRINCIPAL"), controller.remove);
