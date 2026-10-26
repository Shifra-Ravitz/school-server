import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import * as controller from "./subjects.controller.js";

export const subjectsRouter = Router();

subjectsRouter.use(requireAuth);

subjectsRouter.get("/", controller.list);
subjectsRouter.post("/", requireRole("PRINCIPAL"), controller.create);
subjectsRouter.patch("/:id", requireRole("PRINCIPAL"), controller.update);
subjectsRouter.delete("/:id", requireRole("PRINCIPAL"), controller.remove);
