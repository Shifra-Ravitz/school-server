import "dotenv/config";
import { z } from "zod";

/**
 * כל הגדרות השרת מגיעות ממשתני סביבה (קובץ .env במחשב, או הגדרות השירות בענן).
 * אם חסרה הגדרה חובה, השרת לא יעלה ויסביר מה חסר.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "חסר DATABASE_URL - כתובת מסד הנתונים"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET חייב להיות באורך 32 תווים לפחות"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n");
  // eslint-disable-next-line no-console
  console.error(`\nהגדרות השרת אינן תקינות:\n${problems}\nבדקי את קובץ .env (ראי .env.example).\n`);
  process.exit(1);
}

export const env = parsed.data;

/** רשימת הכתובות שמותר להן לפנות לשרת (CORS). "*" = כולן. */
export const corsOrigins = env.CORS_ORIGINS.split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);
