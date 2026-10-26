import cors from "cors";
import express, { Router } from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { corsOrigins } from "./config/env.js";
import { openApiSpec } from "./docs/openapi.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { assignmentsRouter } from "./modules/assignments/assignments.routes.js";
import { attendanceRouter } from "./modules/attendance/attendance.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { birthdaysRouter } from "./modules/birthdays/birthdays.routes.js";
import { classesRouter } from "./modules/classes/classes.routes.js";
import { exportsRouter } from "./modules/exports/exports.routes.js";
import { gradingRouter } from "./modules/grading/grading.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { meRouter } from "./modules/me/me.routes.js";
import { messagesRouter } from "./modules/messages/messages.routes.js";
import { scheduleRouter } from "./modules/schedule/schedule.routes.js";
import { subjectsRouter } from "./modules/subjects/subjects.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";

/** בונה את אפליקציית Express עם כל הנתיבים. משמש גם את השרת וגם את הבדיקות. */
export function createApp() {
  const app = express();

  // מאחורי שרת ביניים בענן (Render) - כדי לזהות נכון את כתובת הלקוח
  app.set("trust proxy", 1);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: corsOrigins.includes("*") ? true : corsOrigins,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      exposedHeaders: ["Content-Disposition"],
    }),
  );
  app.use(express.json({ limit: "200kb" }));

  // ---- תיעוד Swagger ----
  app.get("/api-docs.json", (_req, res) => {
    res.json(openApiSpec);
  });
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      customSiteTitle: "תיעוד API - מערכת ניהול בית ספר",
      swaggerOptions: { persistAuthorization: true, docExpansion: "none", filter: true },
    }),
  );

  // דף הבית של השרת מפנה לתיעוד
  app.get("/", (_req, res) => {
    res.redirect("/api-docs");
  });

  // ---- כל נתיבי ה־API ----
  const api = Router();
  api.use("/health", healthRouter);
  api.use("/auth", authRouter);
  api.use("/users", usersRouter);
  api.use("/classes", classesRouter);
  api.use("/subjects", subjectsRouter);
  api.use("/assignments", assignmentsRouter);
  api.use(gradingRouter); // /assignments/:id/periods, /periods, /exams ...
  api.use(attendanceRouter); // /assignments/:id/attendance, /attendance ...
  api.use(scheduleRouter); // /schedule, /lessons
  api.use("/me", meRouter);
  api.use("/messages", messagesRouter);
  api.use("/birthdays", birthdaysRouter);
  api.use("/exports", exportsRouter);
  app.use("/api", api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
