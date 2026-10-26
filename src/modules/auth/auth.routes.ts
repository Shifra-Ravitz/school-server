import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import * as controller from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/login", controller.login);
authRouter.get("/me", requireAuth, controller.me);
authRouter.patch("/me/password", requireAuth, controller.changePassword);
