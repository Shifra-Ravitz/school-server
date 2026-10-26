import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import * as controller from "./messages.controller.js";

export const messagesRouter = Router();

messagesRouter.use(requireAuth);

// כל משתמשת - התיבה שלה בלבד
messagesRouter.get("/", controller.inbox);
messagesRouter.patch("/read-all", controller.markAllRead);
messagesRouter.patch("/:id/read", controller.markRead);
messagesRouter.delete("/:id", controller.remove);

// שליחה וצפייה בהודעות שנשלחו - מנהלת בלבד
messagesRouter.get("/sent", requireRole("PRINCIPAL"), controller.sent);
messagesRouter.post("/", requireRole("PRINCIPAL"), controller.send);
