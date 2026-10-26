import { Router, type Request, type Response } from "express";
import { prisma } from "../../db/prisma.js";

export const healthRouter = Router();

/** בדיקת בריאות: השרת פועל, והאם יש חיבור למסד הנתונים */
async function health(_req: Request, res: Response) {
  let database = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }
  res.status(database === "ok" ? 200 : 503).json({
    status: database === "ok" ? "ok" : "degraded",
    database,
    time: new Date().toISOString(),
  });
}

healthRouter.get("/", health);
