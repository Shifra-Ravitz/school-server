import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../config/env.js";

/**
 * חיבור יחיד למסד הנתונים שמשותף לכל השרת.
 * Prisma מתחברת ל־PostgreSQL דרך ספריית pg (Driver Adapter).
 */
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
