/**
 * רץ בכל הפעלה של השרת בענן (start:prod).
 * אם SEED_ON_START=true ומסד הנתונים ריק - ממלא אותו בנתוני ההדגמה.
 * אם כבר יש נתונים - לא נוגע בכלום.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { clearDatabase, printSeedResult, runSeed } from "../prisma/seed-lib.js";

/* eslint-disable no-console */
async function main() {
  if (process.env.SEED_ON_START !== "true") return;
  const url = process.env.DATABASE_URL;
  if (!url) return; // השרת עצמו יסביר שחסר DATABASE_URL

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  let seeding = false;
  try {
    const schools = await prisma.school.count();
    if (schools > 0) {
      console.log("מסד הנתונים כבר מכיל נתונים - לא נוצרו נתוני הדגמה.");
      return;
    }
    console.log("מסד הנתונים ריק - יוצרים נתוני הדגמה...");
    seeding = true;
    printSeedResult(await runSeed(prisma));
  } catch (err) {
    // לא עוצרים את השרת בגלל נתוני הדגמה. מנקים נתונים חלקיים כדי שבהפעלה הבאה ינסה שוב.
    console.error("נתוני ההדגמה לא נוצרו:", err instanceof Error ? err.message : err);
    if (seeding) await clearDatabase(prisma).catch(() => undefined);
  } finally {
    await prisma.$disconnect();
  }
}

await main();
