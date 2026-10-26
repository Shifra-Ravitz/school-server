/**
 * יוצר את הקובץ docs/openapi.json מתוך התיעוד שבקוד.
 * הרצה: npm run openapi
 * את הקובץ אפשר לפתוח ב־https://editor.swagger.io או לייבא ל־Postman.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { openApiSpec } from "../src/docs/openapi.js";

const target = path.resolve(import.meta.dirname, "../docs/openapi.json");
mkdirSync(path.dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(openApiSpec, null, 2)}\n`, "utf8");
// eslint-disable-next-line no-console
console.log(`נוצר ${target}`);
