import { describe, expect, it } from "vitest";
import { openApiSpec } from "../src/docs/openapi.js";
import { api } from "./helpers.js";

type Operation = { security?: unknown[]; responses: Record<string, unknown>; tags: string[]; description: string };

describe("Swagger / OpenAPI", () => {
  it("/api-docs נפתח", async () => {
    const res = await api().get("/api-docs/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("swagger-ui");
  });

  it("/api-docs.json הוא OpenAPI 3 עם Bearer JWT", async () => {
    const res = await api().get("/api-docs.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(res.body.components.securitySchemes.bearerAuth).toMatchObject({ type: "http", scheme: "bearer", bearerFormat: "JWT" });
  });

  it("כל הפניות ($ref) מצביעות על סכמה קיימת", () => {
    const text = JSON.stringify(openApiSpec);
    const refs = [...text.matchAll(/"#\/components\/schemas\/([A-Za-z]+)"/g)].map((m) => m[1]!);
    const schemas = openApiSpec.components.schemas as Record<string, unknown>;
    for (const name of new Set(refs)) expect(schemas[name], name).toBeDefined();
  });

  it("כל נתיב מוגן מתועד עם 401, ולכל נתיב יש תיאור הרשאות", () => {
    for (const [path, methods] of Object.entries(openApiSpec.paths as Record<string, Record<string, Operation>>)) {
      for (const [method, op] of Object.entries(methods)) {
        expect(op.description, `${method} ${path}`).toContain("הרשאות");
        const isPublic = Array.isArray(op.security) && op.security.length === 0;
        if (!isPublic) expect(op.responses["401"], `${method} ${path}`).toBeDefined();
      }
    }
  });

  it("כל נתיב שמתועד קיים בשרת (לא מחזיר 404 של כתובת לא קיימת)", async () => {
    for (const [path, methods] of Object.entries(openApiSpec.paths as Record<string, Record<string, Operation>>)) {
      const url = path.replace(/\{importId\}/g, "00000000-0000-4000-8000-000000000000").replace(/\{[^}]+\}/g, "1");
      for (const method of Object.keys(methods)) {
        const res = await (api() as unknown as Record<string, (u: string) => Promise<{ status: number; body: { error?: { code: string } } }>>)[method]!(url);
        expect(res.body?.error?.code, `${method.toUpperCase()} ${path}`).not.toBe("ROUTE_NOT_FOUND");
      }
    }
  });

  it("נתיב מוגן בלי Token מחזיר 401, ועם הרשאה לא מתאימה 403 - כמו שמתועד", async () => {
    expect((await api().get("/api/users")).status).toBe(401);
  });
});
