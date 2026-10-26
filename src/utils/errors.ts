/**
 * שגיאה מסודרת שהשרת מחזיר ללקוח במבנה:
 * { "error": { "code": "...", "message": "...", "details": ... } }
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, "VALIDATION_ERROR", message, details);

export const unauthorized = (message = "יש להתחבר למערכת", code = "UNAUTHORIZED") =>
  new AppError(401, code, message);

export const forbidden = (message = "אין לך הרשאה לפעולה זו") => new AppError(403, "FORBIDDEN", message);

export const notFound = (what = "הרשומה") => new AppError(404, "NOT_FOUND", `${what} לא נמצאה`);

export const conflict = (message: string, details?: unknown) => new AppError(409, "CONFLICT", message, details);

export const businessRule = (code: string, message: string, details?: unknown) =>
  new AppError(422, code, message, details);
