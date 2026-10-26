import { describe, expect, it } from "vitest";
import { api, auth, demoIds, prisma } from "./helpers.js";

describe("תקופות ציון", () => {
  it("מורה רואה את התקופות ואת מצב המשקלים", async () => {
    const { cohenChumash } = await demoIds();
    const res = await api().get(`/api/assignments/${cohenChumash.id}/periods`).set(await auth("teacherCohen"));
    expect(res.status).toBe(200);
    expect(res.body.totalWeight).toBe(100);
    expect(res.body.items[0]).toMatchObject({ name: "מחצית א'", examsWeight: 100, examsCount: 3 });
  });

  it("הוספה, שינוי שם ומשקלים, וחסימת מעבר 100%", async () => {
    const headers = await auth("teacherCohen");
    const { cohenChumash } = await demoIds();
    const over = await api().post(`/api/assignments/${cohenChumash.id}/periods`).set(headers).send({ name: "סמסטר ג'", weight: 10 });
    expect(over.status).toBe(422);
    expect(over.body.error.code).toBe("WEIGHT_EXCEEDED");
    expect(over.body.error.details.maxAllowed).toBe(0);

    const created = await api().post(`/api/assignments/${cohenChumash.id}/periods`).set(headers).send({ name: "סמסטר ג'", weight: 0 });
    expect(created.status).toBe(201);
    const period = created.body.items.find((p: { name: string }) => p.name === "סמסטר ג'");
    expect(period.sortOrder).toBe(3);

    const dupName = await api().post(`/api/assignments/${cohenChumash.id}/periods`).set(headers).send({ name: "סמסטר ג'", weight: 0 });
    expect(dupName.status).toBe(409);

    const renamed = await api().patch(`/api/periods/${period.id}`).set(headers).send({ name: "תוספת" });
    expect(renamed.body.items.some((p: { name: string }) => p.name === "תוספת")).toBe(true);
    expect((await api().delete(`/api/periods/${period.id}`).set(headers)).status).toBe(204);
  });

  it("אי אפשר למחוק תקופה שיש בה מבחנים (409)", async () => {
    const { cohenChumash } = await demoIds();
    const periods = await prisma.gradePeriod.findMany({ where: { assignmentId: cohenChumash.id }, orderBy: { sortOrder: "asc" } });
    const res = await api().delete(`/api/periods/${periods[0]!.id}`).set(await auth("teacherCohen"));
    expect(res.status).toBe(409);
  });
});

describe("מבחנים", () => {
  it("רשימה ממוינת לפי תאריך, סינון לפי תקופה, תאריכים וחיפוש", async () => {
    const headers = await auth("teacherCohen");
    const { cohenChumash } = await demoIds();
    const all = await api().get(`/api/assignments/${cohenChumash.id}/exams`).set(headers);
    expect(all.status).toBe(200);
    const dates = all.body.map((e: { date: string }) => e.date);
    expect(dates).toEqual([...dates].sort());
    expect(all.body[0]).toHaveProperty("average");

    const ranged = await api().get(`/api/assignments/${cohenChumash.id}/exams?from=2026-10-01&to=2026-10-31`).set(headers);
    expect(ranged.body.every((e: { date: string }) => e.date >= "2026-10-01" && e.date <= "2026-10-31")).toBe(true);

    const search = await api().get(`/api/assignments/${cohenChumash.id}/exams?search=${encodeURIComponent("נח")}`).set(headers);
    expect(search.body).toHaveLength(1);

    const desc = await api().get(`/api/assignments/${cohenChumash.id}/exams?sortBy=weight&order=desc`).set(headers);
    expect(desc.body[0].weight).toBe(50);

    const bad = await api().get(`/api/assignments/${cohenChumash.id}/exams?from=2026-10-31&to=2026-10-01`).set(headers);
    expect(bad.status).toBe(400);
  });

  it("CRUD מבחן עם בדיקת משקלים", async () => {
    const headers = await auth("teacherCohen");
    const { cohenChumash } = await demoIds();
    const periodB = await prisma.gradePeriod.findFirstOrThrow({ where: { assignmentId: cohenChumash.id, name: "מחצית ב'" } });

    const created = await api()
      .post(`/api/periods/${periodB.id}/exams`)
      .set(headers)
      .send({ title: "מבחן פרשת וישלח", date: "2027-02-10", weight: 60, description: "פרקים לב-לג" });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ title: "מבחן פרשת וישלח", weight: 60, period: { name: "מחצית ב'" }, gradesCount: 0 });

    const over = await api().post(`/api/periods/${periodB.id}/exams`).set(headers).send({ title: "עוד מבחן", date: "2027-03-01", weight: 50 });
    expect(over.status).toBe(422);

    const edited = await api().patch(`/api/exams/${created.body.id}`).set(headers).send({ weight: 40, description: null });
    expect(edited.body).toMatchObject({ weight: 40, description: null });

    const second = await api().post(`/api/periods/${periodB.id}/exams`).set(headers).send({ title: "עוד מבחן", date: "2027-03-01", weight: 50 });
    expect(second.status).toBe(201);

    // העברה לתקופה מלאה - נחסמת
    const periodA = await prisma.gradePeriod.findFirstOrThrow({ where: { assignmentId: cohenChumash.id, name: "מחצית א'" } });
    const move = await api().patch(`/api/exams/${second.body.id}`).set(headers).send({ periodId: periodA.id });
    expect(move.status).toBe(422);

    expect((await api().delete(`/api/exams/${second.body.id}`).set(headers)).status).toBe(204);
    expect((await api().delete(`/api/exams/${created.body.id}`).set(headers)).status).toBe(204);
    expect((await api().get(`/api/exams/${created.body.id}`).set(headers)).status).toBe(404);
  });

  it("ולידציה של מבחן", async () => {
    const { cohenChumash } = await demoIds();
    const periodB = await prisma.gradePeriod.findFirstOrThrow({ where: { assignmentId: cohenChumash.id, name: "מחצית ב'" } });
    const res = await api()
      .post(`/api/periods/${periodB.id}/exams`)
      .set(await auth("teacherCohen"))
      .send({ title: "א", date: "10/02/2027", weight: 0 });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(["title", "date", "weight"]));
  });
});

describe("ציונים", () => {
  it("כל תלמידות הכיתה מופיעות, עם ציון או null", async () => {
    const { cohenChumash } = await demoIds();
    const exam = await prisma.exam.findFirstOrThrow({ where: { period: { assignmentId: cohenChumash.id } }, orderBy: { date: "desc" } });
    const res = await api().get(`/api/exams/${exam.id}/grades`).set(await auth("teacherCohen"));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(23);
    expect(res.body.items.every((i: { score: number | null }) => i.score === null)).toBe(true); // מבחן עתידי
  });

  it("שמירת ציונים עשרוניים והערכות, ומחיקת ציון", async () => {
    const headers = await auth("teacherCohen");
    const { cohenChumash, younger } = await demoIds();
    const exam = await prisma.exam.findFirstOrThrow({ where: { period: { assignmentId: cohenChumash.id } }, orderBy: { date: "desc" } });

    const save = await api()
      .put(`/api/exams/${exam.id}/grades`)
      .set(headers)
      .send({ grades: [{ studentId: younger.id, score: 98.75, evaluation: "כל הכבוד!" }] });
    expect(save.status).toBe(200);
    const row = save.body.items.find((i: { student: { id: number } }) => i.student.id === younger.id);
    expect(row).toMatchObject({ score: 98.75, evaluation: "כל הכבוד!" });
    expect(save.body.exam.gradesCount).toBe(1);

    // עדכון ציון בלי לשלוח הערכה - ההערכה נשמרת
    const update = await api().put(`/api/exams/${exam.id}/grades`).set(headers).send({ grades: [{ studentId: younger.id, score: 99.5 }] });
    expect(update.body.items.find((i: { student: { id: number } }) => i.student.id === younger.id)).toMatchObject({
      score: 99.5,
      evaluation: "כל הכבוד!",
    });

    const remove = await api().put(`/api/exams/${exam.id}/grades`).set(headers).send({ grades: [{ studentId: younger.id, score: null }] });
    expect(remove.body.items.find((i: { student: { id: number } }) => i.student.id === younger.id).score).toBeNull();
  });

  it("ציון לא תקין נדחה (מעל 100, יותר משתי ספרות, תלמידה מכיתה אחרת)", async () => {
    const headers = await auth("teacherCohen");
    const { cohenChumash, younger, older } = await demoIds();
    const exam = await prisma.exam.findFirstOrThrow({ where: { period: { assignmentId: cohenChumash.id } } });
    expect((await api().put(`/api/exams/${exam.id}/grades`).set(headers).send({ grades: [{ studentId: younger.id, score: 101 }] })).status).toBe(400);
    expect((await api().put(`/api/exams/${exam.id}/grades`).set(headers).send({ grades: [{ studentId: younger.id, score: 90.123 }] })).status).toBe(400);
    expect((await api().put(`/api/exams/${exam.id}/grades`).set(headers).send({ grades: [{ studentId: older.id, score: 90 }] })).status).toBe(400);
    expect(
      (await api().put(`/api/exams/${exam.id}/grades`).set(headers).send({ grades: [{ studentId: younger.id, score: null, evaluation: "טקסט" }] })).status,
    ).toBe(400);
  });

  it("ציונים סופיים: תקופה שהושלמה מחושבת, והשנתי לא - עם הסבר", async () => {
    const { cohenDinim } = await demoIds();
    const res = await api().get(`/api/assignments/${cohenDinim.id}/final-grades`).set(await auth("teacherCohen"));
    expect(res.status).toBe(200);
    expect(res.body.periods[0]).toMatchObject({ name: "מחצית א'", isComplete: true, examsWeight: 100 });
    expect(res.body.canCalculateAnnual).toBe(false);
    expect(res.body.problems).toContain("במחצית ב' עדיין לא הוגדרו מבחנים");

    const student = res.body.students[0];
    const periodId = String(res.body.periods[0].id);
    const exams = res.body.periods[0].exams;
    const expected = exams.reduce((s: number, e: { id: number; weight: number }) => s + (student.scores[e.id] ?? 0) * e.weight, 0) / 100;
    expect(student.periodGrades[periodId]).toBe(Math.round(expected * 10) / 10);
    expect(student.annualGrade).toBeNull();
  });

  it("קורס סמסטריאלי (סמסטר ב' = 0%): ציון שנתי מחושב, ומיון לפי ציון שנתי", async () => {
    const { assignment, classD1 } = await demoIds();
    const geo = await assignment(classD1.id, "ידיעת הארץ");
    const res = await api()
      .get(`/api/assignments/${geo.id}/final-grades?sortBy=annual&order=desc`)
      .set(await auth("principal"));
    expect(res.body.canCalculateAnnual).toBe(true);
    expect(res.body.periods.map((p: { name: string }) => p.name)).toEqual(["סמסטר א'", "סמסטר ב'"]);
    const annual = res.body.students.map((s: { annualGrade: number }) => s.annualGrade);
    expect(annual.every((a: number | null) => typeof a === "number")).toBe(true);
    expect(annual).toEqual([...annual].sort((a: number, b: number) => b - a));
  });
});
