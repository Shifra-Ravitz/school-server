import type { Request, Response } from "express";
import { getAuth } from "../../middleware/auth.js";
import { assertLoginAllowed, clearLoginFailures, recordLoginFailure } from "../../middleware/loginLimiter.js";
import { AppError } from "../../utils/errors.js";
import { parse } from "../../utils/validation.js";
import * as authService from "./auth.service.js";
import { changePasswordSchema, loginSchema } from "./auth.schemas.js";

export async function login(req: Request, res: Response) {
  const { email, password } = parse(loginSchema, req.body);
  const ip = req.ip ?? "unknown";
  assertLoginAllowed(ip, email);
  try {
    const result = await authService.login(email, password);
    clearLoginFailures(ip, email);
    res.json(result);
  } catch (err) {
    if (err instanceof AppError && err.status === 401) recordLoginFailure(ip, email);
    throw err;
  }
}

export async function me(req: Request, res: Response) {
  res.json({ user: await authService.getMe(getAuth(req).id) });
}

export async function changePassword(req: Request, res: Response) {
  const body = parse(changePasswordSchema, req.body);
  await authService.changePassword(getAuth(req).id, body.currentPassword, body.newPassword);
  res.status(204).end();
}
