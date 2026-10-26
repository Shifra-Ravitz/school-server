import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { prisma } from "../db/prisma.js";
import { conflict } from "./errors.js";

/** בבדיקות אוטומטיות משתמשים בהצפנה קלה יותר כדי שירוצו מהר */
const ROUNDS = process.env.NODE_ENV === "test" ? 4 : 10;

/** הצפנה חד־כיוונית של סיסמה. את הסיסמה המקורית אי אפשר לשחזר. */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// בלי תווים שקל להתבלבל ביניהם (O ו־0, l ו־1)
const LETTERS = "abcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";

/** סיסמה אקראית קריאה, למשל "kd7mx4pa" */
export function generatePassword(length = 8): string {
  const pool = LETTERS + DIGITS;
  let result = "";
  for (let i = 0; i < length; i++) result += pool[randomInt(pool.length)];
  // מוודאים שיש לפחות ספרה אחת
  if (!/\d/.test(result)) result = result.slice(0, -1) + DIGITS[randomInt(DIGITS.length)];
  return result;
}

/**
 * כמה משתמשות יכולות לחלוק מייל (למשל אחיות עם המייל של ההורים).
 * כדי שההתחברות תדע מי נכנסה, אסור שלשתיים עם אותו מייל תהיה אותה סיסמה.
 * מחזיר true אם הסיסמה כבר בשימוש אצל משתמשת אחרת עם המייל הזה.
 */
export async function isPasswordTakenForEmail(email: string, plain: string, excludeUserId?: number): Promise<boolean> {
  const others = await prisma.user.findMany({
    where: { email, ...(excludeUserId ? { id: { not: excludeUserId } } : {}) },
    select: { passwordHash: true },
  });
  for (const other of others) {
    if (await verifyPassword(plain, other.passwordHash)) return true;
  }
  return false;
}

export async function assertPasswordAvailable(email: string, plain: string, excludeUserId?: number): Promise<void> {
  if (await isPasswordTakenForEmail(email, plain, excludeUserId)) {
    throw conflict("יש כבר משתמשת עם אותו מייל ואותה סיסמה. יש לבחור סיסמה אחרת.");
  }
}

/** יוצר סיסמה אקראית שלא בשימוש אצל משתמשת אחרת עם אותו מייל */
export async function generateAvailablePassword(email: string, excludeUserId?: number): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generatePassword();
    if (!(await isPasswordTakenForEmail(email, candidate, excludeUserId))) return candidate;
  }
  throw new Error("לא הצלחנו ליצור סיסמה ייחודית");
}
