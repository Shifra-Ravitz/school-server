import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import * as controller from "./birthdays.controller.js";

export const birthdaysRouter = Router();

birthdaysRouter.get("/today", requireAuth, controller.today);
