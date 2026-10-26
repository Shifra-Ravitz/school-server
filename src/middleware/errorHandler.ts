import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { AppError } from "../utils/errors.js";

/** כתובת שלא קיימת בשרת */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: "ROUTE_NOT_FOUND", message: `הכתובת ${req.method} ${req.path} לא קיימת` },
  });
}

/**
 * טיפול מרכזי בשגיאות. כל שגיאה בשרת מגיעה לכאן והופכת לתשובה מסודרת.
 * פרטים פנימיים (כמו שגיאות של מסד הנתונים) לא נחשפים ללקוח.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details !== undefined ? { details: err.details } : {}) },
    });
    return;
  }

  // JSON שבור בגוף הבקשה
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: { code: "INVALID_JSON", message: "גוף הבקשה אינו JSON תקין" } });
    return;
  }

  if (err instanceof multer.MulterError) {
    const tooLarge = err.code === "LIMIT_FILE_SIZE";
    res.status(tooLarge ? 413 : 400).json({
      error: {
        code: tooLarge ? "FILE_TOO_LARGE" : "UPLOAD_ERROR",
        message: tooLarge ? "הקובץ גדול מדי (עד 2MB)" : "שגיאה בהעלאת הקובץ",
      },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({ error: { code: "CONFLICT", message: "רשומה כזו כבר קיימת" } });
      return;
    }
    if (err.code === "P2003") {
      res.status(409).json({ error: { code: "CONFLICT", message: "לא ניתן לבצע: יש רשומות שתלויות ברשומה זו" } });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "הרשומה לא נמצאה" } });
      return;
    }
  }

  const status = typeof err === "object" && err && "status" in err ? Number((err as { status: unknown }).status) : 500;
  if (status === 413) {
    res.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: "הבקשה גדולה מדי" } });
    return;
  }

  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "אירעה שגיאה בשרת" } });
}
