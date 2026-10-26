import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { runSeed } from "../prisma/seed-lib.js";

/**
 * לפני כל הבדיקות: בונים את מסד נתוני הבדיקות מאפס (לפי ה־Migrations)
 * וממלאים אותו בנתוני ההדגמה.
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "חסר TEST_DATABASE_URL בקובץ .env - כתובת של מסד נתונים נפרד לבדיקות (הבדיקות מוחקות את כל הנתונים בו).",
    );
  }

  process.env.NODE_ENV = "test";
  process.env.SEED_DEMO_PASSWORD = "";

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
    const migrationsDir = path.resolve(import.meta.dirname, "../prisma/migrations");
    const folders = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    for (const folder of folders) {
      await client.query(readFileSync(path.join(migrationsDir, folder, "migration.sql"), "utf8"));
    }
  } finally {
    await client.end();
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    await runSeed(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
