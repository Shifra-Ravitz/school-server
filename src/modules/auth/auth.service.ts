import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { signToken } from "../../middleware/auth.js";
import { AppError, unauthorized, notFound } from "../../utils/errors.js";
import { assertPasswordAvailable, hashPassword, verifyPassword } from "../../utils/passwords.js";
import { publicUser, publicUserSelect } from "../../utils/serializers.js";

const INVALID_LOGIN = "מייל או סיסמה שגויים";

/**
 * התחברות במייל וסיסמה.
 * כמה משתמשות יכולות לחלוק מייל (אחיות), ולכן בודקים את הסיסמה מול כל אחת מהן.
 */
export async function login(email: string, password: string) {
  const candidates = await prisma.user.findMany({
    where: { email, isActive: true },
    select: { ...publicUserSelect, schoolId: true, passwordHash: true, school: { select: { id: true, name: true } } },
  });

  const matches = [];
  for (const candidate of candidates) {
    if (await verifyPassword(password, candidate.passwordHash)) matches.push(candidate);
  }

  if (matches.length === 0) throw unauthorized(INVALID_LOGIN, "INVALID_CREDENTIALS");
  if (matches.length > 1) {
    throw new AppError(409, "AMBIGUOUS_LOGIN", "יש יותר ממשתמשת אחת עם פרטים אלה. יש לפנות למנהלת לאיפוס סיסמה.");
  }

  const user = matches[0]!;
  return {
    token: signToken({ id: user.id, role: user.role, schoolId: user.schoolId }),
    expiresIn: env.JWT_EXPIRES_IN,
    user: { ...publicUser(user), school: user.school },
  };
}

export async function getMe(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ...publicUserSelect, school: { select: { id: true, name: true, city: true } } },
  });
  if (!user) throw notFound("המשתמשת");
  return { ...publicUser(user), school: user.school };
}

export async function changePassword(userId: number, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, passwordHash: true } });
  if (!user) throw notFound("המשתמשת");
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new AppError(400, "WRONG_PASSWORD", "הסיסמה הנוכחית שגויה");
  }
  await assertPasswordAvailable(user.email, newPassword, userId);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
}
