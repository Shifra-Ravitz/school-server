import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { prisma } from "./db/prisma.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`השרת פועל: http://localhost:${env.PORT}  |  תיעוד: http://localhost:${env.PORT}/api-docs`);
});

/** סגירה מסודרת כשהשרת נעצר (למשל בפריסה חדשה בענן) */
async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
