import "dotenv/config";
import { defineConfig } from "vitest/config";

/**
 * הבדיקות רצות מול מסד נתונים נפרד (TEST_DATABASE_URL), כי הן מוחקות ויוצרות נתונים.
 * אסור להפנות אותן למסד הנתונים האמיתי.
 */
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? "";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/globalSetup.ts"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: testDatabaseUrl,
      TEST_DATABASE_URL: testDatabaseUrl,
      JWT_SECRET: "test-secret-for-automated-tests-only-0123456789",
      JWT_EXPIRES_IN: "1h",
      CORS_ORIGINS: "http://localhost:5173",
      SEED_DEMO_PASSWORD: "",
    },
  },
});
