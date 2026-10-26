import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prisma } from "./helpers.js";

const root = path.resolve(import.meta.dirname, "..");

describe("Prisma ומסד הנתונים", () => {
  it("prisma validate - הסכמה תקינה", () => {
    const output = execSync("npx prisma validate", { cwd: root, env: process.env, encoding: "utf8", stdio: "pipe" });
    expect(output).toContain("is valid");
  });

  it("קיימת Migration שיוצרת את כל הטבלאות שבסכמה", () => {
    const schema = readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
    const models = [...schema.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]!);
    const migrationsDir = path.join(root, "prisma/migrations");
    const sql = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => readFileSync(path.join(migrationsDir, d.name, "migration.sql"), "utf8"))
      .join("\n");
    for (const model of models) expect(sql, model).toContain(`CREATE TABLE "${model}"`);
  });

  it("המסד בבדיקות נבנה מה־Migrations ומכיל את נתוני ההדגמה", async () => {
    expect(await prisma.school.count()).toBeGreaterThanOrEqual(2);
    expect(await prisma.user.count({ where: { role: "STUDENT" } })).toBeGreaterThan(90);
    expect(await prisma.lesson.count()).toBeGreaterThan(100);
  });

  it("אילוצי תקינות: אי אפשר ליצור ציון כפול לאותה תלמידה באותו מבחן", async () => {
    const grade = await prisma.grade.findFirstOrThrow();
    await expect(
      prisma.grade.create({ data: { examId: grade.examId, studentId: grade.studentId, score: 50 } }),
    ).rejects.toThrow();
  });
});
