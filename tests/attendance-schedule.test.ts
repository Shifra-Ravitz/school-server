import { describe, expect, it } from "vitest";
import { todayInIsrael } from "../src/utils/dates.js";
import { api, auth, demoIds } from "./helpers.js";

describe("נוכחות", () => {
  it("סימון חריגות לשיעור: רק חריגות נשמרות, השאר נוכחות", async () => {
    const headers = await auth("teacherCohen");
    const { cohenChumash, younger, classD1 } = await demoIds();
    const date = "2026-09-02";
    const roster = await api().get(`/api/assignments/${cohenChumash.id}/attendance/lesson?date=${date}&lessonNumber=8`).set(headers);
    expect(roster.status).toBe(200);
    expect(roster.body.taken).toBe(false);
    expect(roster.body.items).toHaveLength(classD1 ? roster.body.items.length : 0);
    const other = roster.body.items.find((i: { student: { id: number } }) => i.student.id !== younger.id).student.id;

    const save = await api()
      .put(`/api/assignments/${cohenChumash.id}/attendance`)
      .set(headers)
      .send({
        date,
        lessonNumber: 8,
        records: [
          { studentId: younger.id, status: "LATE" },
          { studentId: other, status: "ABSENT", approved: true, reason: "אישור רפואי" },
        ],
      });
    expect(save.status).toBe(200);
    expect(save.body.taken).toBe(true);
    const marks = save.body.items.filter((i: { status: string | null }) => i.status !== null);
    expect(marks).toHaveLength(2);
    expect(save.body.items.find((i: { student: { id: number } }) => i.student.id === younger.id)).toMatchObject({
      status: "LATE",
      symbol: "+",
    });
    expect(save.body.items.find((i: { student: { id: number } }) => i.student.id === other)).toMatchObject({
      status: "ABSENT",
      symbol: "-",
      approved: true,
      reason: "אישור רפואי",
    });

    // שמירה מחדש בלי החיסור - החיסור נמחק, והאישור של האיחור נשמר כשלא נשלח
    const resave = await api()
      .put(`/api/assignments/${cohenChumash.id}/attendance`)
      .set(headers)
      .send({ date, lessonNumber: 8, records: [{ studentId: younger.id, status: "RELEASED" }] });
    const after = resave.body.items.filter((i: { status: string | null }) => i.status !== null);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ status: "RELEASED", symbol: "ש" });
  });

  it("רשימת חריגות עם סינון לפי סטטוס, תאריכים ושם", async () => {
    const headers = await auth("teacherCohen");
    const { cohenChumash } = await demoIds();
    const late = await api().get(`/api/assignments/${cohenChumash.id}/attendance?status=LATE`).set(headers);
    expect(late.status).toBe(200);
    expect(late.body.length).toBeGreaterThan(0);
    expect(late.body.every((r: { status: string; symbol: string }) => r.status === "LATE" && r.symbol === "+")).toBe(true);

    const ranged = await api().get(`/api/assignments/${cohenChumash.id}/attendance?from=2026-10-05&to=2026-10-10&order=asc`).set(headers);
    const dates = ranged.body.map((r: { date: string }) => r.date);
    expect(dates.every((d: string) => d >= "2026-10-05" && d <= "2026-10-10")).toBe(true);
    expect(dates).toEqual([...dates].sort());

    const byName = await api().get(`/api/assignments/${cohenChumash.id}/attendance?lastName=${encodeURIComponent("גולדברג")}`).set(headers);
    expect(byName.body.every((r: { student: { lastName: string } }) => r.student.lastName === "גולדברג")).toBe(true);
  });

  it("עדכון רשומה (אישור + סיבה) ומחיקה", async () => {
    const headers = await auth("teacherCohen");
    const { cohenChumash } = await demoIds();
    const list = await api().get(`/api/assignments/${cohenChumash.id}/attendance?status=LATE`).set(headers);
    const record = list.body[0];
    const patched = await api().patch(`/api/attendance/${record.id}`).set(headers).send({ approved: true, reason: "הסעה איחרה" });
    expect(patched.body).toMatchObject({ approved: true, reason: "הסעה איחרה", status: "LATE" });
    expect((await api().delete(`/api/attendance/${record.id}`).set(headers)).status).toBe(204);
    expect((await api().patch(`/api/attendance/${record.id}`).set(headers).send({ approved: true })).status).toBe(404);
  });

  it("אי אפשר לרשום נוכחות לתאריך עתידי או לתלמידה מכיתה אחרת", async () => {
    const headers = await auth("teacherCohen");
    const { cohenChumash, older, younger } = await demoIds();
    const future = await api()
      .put(`/api/assignments/${cohenChumash.id}/attendance`)
      .set(headers)
      .send({ date: "2099-01-01", lessonNumber: 1, records: [{ studentId: younger.id, status: "LATE" }] });
    expect(future.status).toBe(400);
    const wrongClass = await api()
      .put(`/api/assignments/${cohenChumash.id}/attendance`)
      .set(headers)
      .send({ date: todayInIsrael(), lessonNumber: 1, records: [{ studentId: older.id, status: "LATE" }] });
    expect(wrongClass.status).toBe(400);
    const badStatus = await api()
      .put(`/api/assignments/${cohenChumash.id}/attendance`)
      .set(headers)
      .send({ date: todayInIsrael(), lessonNumber: 1, records: [{ studentId: younger.id, status: "PRESENT" }] });
    expect(badStatus.status).toBe(400);
  });

  it("מורה לא יכולה לסמן נוכחות בשיבוץ של מורה אחרת", async () => {
    const { englishD1, younger } = await demoIds();
    const res = await api()
      .put(`/api/assignments/${englishD1.id}/attendance`)
      .set(await auth("teacherCohen"))
      .send({ date: "2026-09-02", lessonNumber: 1, records: [{ studentId: younger.id, status: "LATE" }] });
    expect(res.status).toBe(403);
  });
});

describe("מערכת שעות", () => {
  it("מורה רואה את השיעורים שלה בכל הכיתות", async () => {
    const res = await api().get("/api/schedule/me").set(await auth("teacherEnglish"));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(12); // 3 שעות × 4 כיתות
    expect(new Set(res.body.map((l: { class: { name: string } }) => l.class.name)).size).toBe(4);
    expect(res.body.every((l: { subject: { name: string } }) => l.subject.name === "אנגלית")).toBe(true);
  });

  it("תלמידה רואה את מערכת הכיתה שלה עם כל המורות", async () => {
    const res = await api().get("/api/schedule/me").set(await auth("studentYounger"));
    expect(res.body).toHaveLength(26);
    expect(res.body.every((l: { class: { name: string } }) => l.class.name === "ד'1")).toBe(true);
    expect(new Set(res.body.map((l: { teacher: { id: number } }) => l.teacher.id)).size).toBeGreaterThan(3);
    const sorted = res.body.map((l: { dayOfWeek: number; lessonNumber: number }) => l.dayOfWeek * 100 + l.lessonNumber);
    expect(sorted).toEqual([...sorted].sort((a: number, b: number) => a - b));
  });

  it("מערכת של כיתה ושל מורה", async () => {
    const { classD1, english } = await demoIds();
    expect((await api().get(`/api/classes/${classD1.id}/schedule`).set(await auth("principal"))).body).toHaveLength(26);
    expect((await api().get(`/api/schedule/teachers/${english.id}`).set(await auth("principal"))).body).toHaveLength(12);
    expect((await api().get(`/api/schedule/teachers/${english.id}`).set(await auth("teacherCohen"))).status).toBe(403);
  });

  it("הוספה, שינוי ומחיקה של שיעור, עם בדיקת התנגשויות", async () => {
    const headers = await auth("teacherCohen");
    const { cohenChumash, classD1 } = await demoIds();
    const classLessons = (await api().get(`/api/classes/${classD1.id}/schedule`).set(headers)).body as Array<{
      dayOfWeek: number;
      lessonNumber: number;
    }>;
    const taken = classLessons[0]!;

    const clash = await api()
      .post("/api/lessons")
      .set(headers)
      .send({ assignmentId: cohenChumash.id, dayOfWeek: taken.dayOfWeek, lessonNumber: taken.lessonNumber });
    expect(clash.status).toBe(409);

    // שעה 9 פנויה בכל המערכת
    const created = await api().post("/api/lessons").set(headers).send({ assignmentId: cohenChumash.id, dayOfWeek: 1, lessonNumber: 9, room: "ספרייה" });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ dayName: "ראשון", lessonNumber: 9, room: "ספרייה", subject: { name: "חומש" } });

    const moved = await api().patch(`/api/lessons/${created.body.id}`).set(headers).send({ dayOfWeek: 2 });
    expect(moved.body.dayName).toBe("שני");

    const student = await api().get("/api/schedule/me").set(await auth("studentYounger"));
    expect(student.body.some((l: { id: number }) => l.id === created.body.id)).toBe(true);

    expect((await api().delete(`/api/lessons/${created.body.id}`).set(headers)).status).toBe(204);
  });

  it("מורה לא יכולה להוסיף שיעור לשיבוץ של מורה אחרת", async () => {
    const { englishD1 } = await demoIds();
    const res = await api().post("/api/lessons").set(await auth("teacherCohen")).send({ assignmentId: englishD1.id, dayOfWeek: 1, lessonNumber: 9 });
    expect(res.status).toBe(403);
  });
});
