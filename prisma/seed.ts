/**
 * מילוי מסד הנתונים בנתוני הדגמה: npm run db:seed
 * שימי לב: הפקודה מוחקת את כל הנתונים הקיימים ויוצרת אותם מחדש.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { printSeedResult, runSeed } from "./seed-lib.js";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("חסר DATABASE_URL בקובץ .env");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const result = await runSeed(prisma);
    printSeedResult(result);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
