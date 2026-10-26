import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { forbidden, unauthorized } from "../utils/errors.js";
import type { AuthUser } from "../types/express.js";

interface TokenPayload {
  sub: string;
  role: Role;
  schoolId: number;
}

/** יוצר Token חתום עם תוקף מוגבל */
export function signToken(user: { id: number; role: Role; schoolId: number }): string {
  const payload: Omit<TokenPayload, "sub"> = { role: user.role, schoolId: user.schoolId };
  return jwt.sign(payload, env.JWT_SECRET, {
    subject: String(user.id),
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

/**
 * Authentication: מוודא שנשלח Token תקין בכותרת Authorization: Bearer <token>.
 * המשתמשת נקבעת רק לפי ה־Token, ולא לפי מזהה שהלקוח שולח.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw unauthorized("יש להתחבר למערכת (חסר Token)");
  }
  const token = header.slice("Bearer ".length).trim();

  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as unknown as TokenPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw unauthorized("פג תוקף ההתחברות, יש להתחבר מחדש", "TOKEN_EXPIRED");
    }
    throw unauthorized("ה־Token אינו תקין", "INVALID_TOKEN");
  }

  const userId = Number(payload.sub);
  if (!Number.isInteger(userId)) throw unauthorized("ה־Token אינו תקין", "INVALID_TOKEN");

  // טוענים מחדש מהמסד, כדי שמשתמשת שהושבתה לא תוכל להמשיך לעבוד
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, schoolId: true, classId: true, firstName: true, lastName: true, isActive: true },
  });
  if (!user || !user.isActive) throw unauthorized("המשתמשת אינה פעילה", "INVALID_TOKEN");

  const { isActive: _ignored, ...auth } = user;
  req.auth = auth;
  next();
}

/** Authorization: מאפשר גישה רק לתפקידים שברשימה. אחרת 403. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const auth = req.auth;
    if (!auth) throw unauthorized();
    if (!roles.includes(auth.role)) throw forbidden();
    next();
  };
}

/** מחזיר את המשתמשת המחוברת (אחרי requireAuth) */
export function getAuth(req: Request): AuthUser {
  if (!req.auth) throw unauthorized();
  return req.auth;
}
