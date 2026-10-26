import { AppError } from "../utils/errors.js";

/**
 * הגנה בסיסית מניחוש סיסמאות: אחרי 10 ניסיונות כושלים
 * מאותה כתובת ולאותו מייל, חוסמים ל־15 דקות.
 * הנתונים נשמרים בזיכרון השרת בלבד.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

const failures = new Map<string, { count: number; firstAt: number }>();

function keyOf(ip: string, email: string) {
  return `${ip}|${email.toLowerCase()}`;
}

export function assertLoginAllowed(ip: string, email: string): void {
  const entry = failures.get(keyOf(ip, email));
  if (!entry) return;
  if (Date.now() - entry.firstAt > WINDOW_MS) {
    failures.delete(keyOf(ip, email));
    return;
  }
  if (entry.count >= MAX_FAILURES) {
    throw new AppError(429, "TOO_MANY_ATTEMPTS", "יותר מדי ניסיונות התחברות. נסי שוב בעוד 15 דקות.");
  }
}

export function recordLoginFailure(ip: string, email: string): void {
  const key = keyOf(ip, email);
  const entry = failures.get(key);
  if (!entry || Date.now() - entry.firstAt > WINDOW_MS) failures.set(key, { count: 1, firstAt: Date.now() });
  else entry.count++;
}

export function clearLoginFailures(ip: string, email: string): void {
  failures.delete(keyOf(ip, email));
}
