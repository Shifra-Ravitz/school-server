/**
 * הוספת בית ספר חדש עם חשבון מנהלת - כשמנהלת פונה ומבקשת להצטרף.
 *
 * דוגמה:
 * npm run create-school -- --name "בית יעקב החדש" --city "אלעד" --first "מרים" --last "שפירא" --email "menahelet@new-school.example"
 *
 * אם לא נותנים --password, נוצרת סיסמה אקראית ומודפסת פעם אחת.
 * רשות: --subjects "חומש,נביא,חשבון" - מקצועות שייווצרו מראש.
 */
import "dotenv/config";
import { parseArgs } from "node:util";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/* eslint-disable no-console */
function fail(message: string): never {
  console.error(`\nשגיאה: ${message}\n`);
  console.error(
    'שימוש: npm run create-school -- --name "שם בית הספר" --city "עיר" --first "שם פרטי" --last "שם משפחה" --email "מייל" [--password "סיסמה"] [--subjects "חומש,חשבון"]\n',
  );
  process.exit(1);
}

function randomPassword(): string {
  const pool = "abcdefghjkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 10; i++) p += pool[randomInt(pool.length)];
  return p;
}

async function main() {
  const { values } = parseArgs({
    options: {
      name: { type: "string" },
      city: { type: "string" },
      first: { type: "string" },
      last: { type: "string" },
      email: { type: "string" },
      password: { type: "string" },
      subjects: { type: "string" },
    },
  });

  const name = values.name?.trim();
  const first = values.first?.trim();
  const last = values.last?.trim();
  const email = values.email?.trim().toLowerCase();
  if (!name || name.length < 2) fail("חסר שם בית ספר (--name)");
  if (!first || !last) fail("חסר שם המנהלת (--first ו־--last)");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) fail("חסר מייל תקין (--email)");
  if (values.password && values.password.length < 6) fail("סיסמה חייבת להכיל לפחות 6 תווים");

  const url = process.env.DATABASE_URL;
  if (!url) fail("חסר DATABASE_URL בקובץ .env");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    if (await prisma.school.findUnique({ where: { name } })) fail(`כבר קיים בית ספר בשם "${name}"`);

    const password = values.password ?? randomPassword();
    const subjects = (values.subjects ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const school = await prisma.school.create({
      data: {
        name,
        city: values.city?.trim() || null,
        users: {
          create: {
            role: "PRINCIPAL",
            firstName: first,
            lastName: last,
            email,
            passwordHash: await bcrypt.hash(password, 10),
          },
        },
        subjects: { create: [...new Set(subjects)].map((s) => ({ name: s })) },
      },
    });

    console.log(`\nבית הספר "${school.name}" נוצר בהצלחה (מזהה ${school.id}).`);
    console.log(`חשבון מנהלת: ${first} ${last}`);
    console.log(`מייל: ${email}`);
    if (!values.password) console.log(`סיסמה זמנית (מוצגת פעם אחת בלבד): ${password}`);
    console.log("מומלץ שהמנהלת תשנה את הסיסמה אחרי ההתחברות הראשונה.\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
