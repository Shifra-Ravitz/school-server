import { describe, expect, it } from "vitest";
import { api, auth, demoIds } from "./helpers.js";

describe("כיתות, מקצועות ושיבוצים", () => {
  it("רשימת כיתות עם שם מחושב ומספר תלמידות, וסינון לפי שכבה", async () => {
    const headers = await auth("principal");
    const res = await api().get("/api/classes").set(headers);
    expect(res.body.map((c: { name: string }) => c.name)).toEqual(["ד'1", "ד'2", "ה'1", "ה'2"]);
    expect(res.body[0].studentsCount).toBeGreaterThan(20);
    const grade5 = await api().get("/api/classes?gradeLevel=5").set(headers);
    expect(grade5.body).toHaveLength(2);
  });

  it("פרטי כיתה כוללים את השיבוצים", async () => {
    const { classD1 } = await demoIds();
    const res = await api().get(`/api/classes/${classD1.id}`).set(await auth("teacherCohen"));
    expect(res.status).toBe(200);
    expect(res.body.assignments).toHaveLength(8);
    expect(res.body.assignments.filter((a: { isMine: boolean }) => a.isMine)).toHaveLength(4);
  });

  it("תלמידות כיתה: חיפוש לפי שם ומיון", async () => {
    const { classD1 } = await demoIds();
    const headers = await auth("teacherCohen");
    const res = await api().get(`/api/classes/${classD1.id}/students?sortBy=lastName&order=desc`).set(headers);
    expect(res.status).toBe(200);
    const last = res.body.map((s: { lastName: string }) => s.lastName);
    expect(last).toEqual([...last].sort((a: string, b: string) => b.localeCompare(a, "he")));
    const search = await api().get(`/api/classes/${classD1.id}/students?lastName=${encodeURIComponent("גולד")}`).set(headers);
    expect(search.body[0].firstName).toBe("חיה");
  });

  it("CRUD כיתה: יצירה, כפילות, עריכה ומחיקה של כיתה ריקה", async () => {
    const headers = await auth("principal");
    const created = await api().post("/api/classes").set(headers).send({ gradeLevel: 6, parallel: 1 });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: "ו'1", studentsCount: 0 });

    const dup = await api().post("/api/classes").set(headers).send({ gradeLevel: 6, parallel: 1 });
    expect(dup.status).toBe(409);

    const updated = await api().patch(`/api/classes/${created.body.id}`).set(headers).send({ parallel: 3 });
    expect(updated.body.name).toBe("ו'3");

    expect((await api().delete(`/api/classes/${created.body.id}`).set(headers)).status).toBe(204);
  });

  it("אי אפשר למחוק כיתה עם תלמידות (409)", async () => {
    const { classD1 } = await demoIds();
    const res = await api().delete(`/api/classes/${classD1.id}`).set(await auth("principal"));
    expect(res.status).toBe(409);
  });

  it("ולידציה של כיתה", async () => {
    const res = await api().post("/api/classes").set(await auth("principal")).send({ gradeLevel: 13, parallel: 0 });
    expect(res.status).toBe(400);
  });

  it("מקצועות: כולן רואות, רק מנהלת משנה", async () => {
    expect((await api().get("/api/subjects").set(await auth("studentYounger"))).body.length).toBe(8);
    const headers = await auth("principal");
    const created = await api().post("/api/subjects").set(headers).send({ name: "שירה" });
    expect(created.status).toBe(201);
    expect((await api().post("/api/subjects").set(headers).send({ name: "שירה" })).status).toBe(409);
    const renamed = await api().patch(`/api/subjects/${created.body.id}`).set(headers).send({ name: "מוזיקה" });
    expect(renamed.body.name).toBe("מוזיקה");
    expect((await api().delete(`/api/subjects/${created.body.id}`).set(headers)).status).toBe(204);

    const used = await demoIds().then((d) => d.subject("חומש"));
    expect((await api().delete(`/api/subjects/${used.id}`).set(headers)).status).toBe(409);
  });

  it("שיבוץ חדש: נוצרות מחצית א' ומחצית ב', ואין כפילות", async () => {
    const headers = await auth("principal");
    const { classD1, english } = await demoIds();
    const subject = await api().post("/api/subjects").set(headers).send({ name: "ציור" });
    const created = await api()
      .post("/api/assignments")
      .set(headers)
      .send({ classId: classD1.id, subjectId: subject.body.id, teacherId: english.id });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ class: { name: "ד'1" }, subject: { name: "ציור" }, teacher: { lastName: "הורוביץ" } });

    const periods = await api().get(`/api/assignments/${created.body.id}/periods`).set(headers);
    expect(periods.body.items.map((p: { name: string; weight: number }) => [p.name, p.weight])).toEqual([
      ["מחצית א'", 50],
      ["מחצית ב'", 50],
    ]);

    const dup = await api()
      .post("/api/assignments")
      .set(headers)
      .send({ classId: classD1.id, subjectId: subject.body.id, teacherId: english.id });
    expect(dup.status).toBe(409);

    // מחיקה אפשרית כי אין ציונים ונוכחות
    expect((await api().delete(`/api/assignments/${created.body.id}`).set(headers)).status).toBe(204);
  });

  it("שיבוץ עם מורה שאינה מורה נדחה", async () => {
    const { classD1, younger } = await demoIds();
    const subject = await demoIds().then((d) => d.subject("חומש"));
    const res = await api()
      .post("/api/assignments")
      .set(await auth("principal"))
      .send({ classId: classD1.id, subjectId: subject.id, teacherId: younger.id });
    expect(res.status).toBe(400);
  });

  it("אי אפשר למחוק שיבוץ שיש בו ציונים (409)", async () => {
    const { cohenDinim } = await demoIds();
    const res = await api().delete(`/api/assignments/${cohenDinim.id}`).set(await auth("principal"));
    expect(res.status).toBe(409);
  });
});
