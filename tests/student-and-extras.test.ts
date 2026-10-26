import { HDate } from "@hebcal/core";
import { describe, expect, it } from "vitest";
import { api, auth, demoIds } from "./helpers.js";

describe("אזור התלמידה", () => {
  it("הציונים שלי - מקובצים לפי מקצוע, רק שלי", async () => {
    const res = await api().get("/api/me/grades").set(await auth("studentYounger"));
    expect(res.status).toBe(200);
    expect(res.body.subjects).toHaveLength(8);
    const geo = res.body.subjects.find((s: { subject: { name: string } }) => s.subject.name === "ידיעת הארץ");
    expect(geo.canCalculateAnnual).toBe(true);
    expect(typeof geo.annualGrade).toBe("number");
    expect(geo.periods[0].exams[0]).toHaveProperty("score");
    expect(geo.periods[0].exams[0]).toHaveProperty("evaluation");
    expect(JSON.stringify(res.body)).not.toContain("studentId");
  });

  it("סינון הציונים לפי מקצוע ותקופה", async () => {
    const { subject } = await demoIds();
    const dinim = await subject("דינים");
    const headers = await auth("studentYounger");
    const bySubject = await api().get(`/api/me/grades?subjectId=${dinim.id}`).set(headers);
    expect(bySubject.body.subjects).toHaveLength(1);
    const periodId = bySubject.body.subjects[0].periods[1].id;
    const byPeriod = await api().get(`/api/me/grades?subjectId=${dinim.id}&periodId=${periodId}`).set(headers);
    expect(byPeriod.body.subjects[0].periods).toHaveLength(1);
    expect(byPeriod.body.subjects[0].periods[0].name).toBe("מחצית ב'");
  });

  it("הנוכחות שלי עם סיכום כללי ולפי מקצוע", async () => {
    const res = await api().get("/api/me/attendance").set(await auth("studentOlder"));
    expect(res.status).toBe(200);
    expect(res.body.summary.lessons).toBeGreaterThan(0);
    expect(res.body.summary.bySubject).toHaveLength(8);
    expect(res.body.summary.attendancePercent).toBeGreaterThan(0);
    for (const item of res.body.items) expect(["+", "-", "ש"]).toContain(item.symbol);

    const lateOnly = await api().get("/api/me/attendance?status=LATE").set(await auth("studentOlder"));
    expect(lateOnly.body.items.every((i: { status: string }) => i.status === "LATE")).toBe(true);
  });
});

describe("הודעות", () => {
  it("מנהלת שולחת הודעה לכיתה, והיא מגיעה רק לתלמידות הכיתה", async () => {
    const { classD1 } = await demoIds();
    const sent = await api()
      .post("/api/messages")
      .set(await auth("principal"))
      .send({ title: "הודעה לד'1", body: "מחר לימודים עד 12:00", audience: "CLASS", classId: classD1.id });
    expect(sent.status).toBe(201);
    expect(sent.body.recipientsCount).toBeGreaterThan(20);

    const younger = await api().get("/api/messages?unread=true").set(await auth("studentYounger"));
    expect(younger.body.items.some((m: { id: number }) => m.id === sent.body.id)).toBe(true);
    const older = await api().get("/api/messages").set(await auth("studentOlder"));
    expect(older.body.items.some((m: { id: number }) => m.id === sent.body.id)).toBe(false);
  });

  it("CLASS בלי כיתה נדחה", async () => {
    const res = await api().post("/api/messages").set(await auth("principal")).send({ title: "חסר", body: "טקסט", audience: "CLASS" });
    expect(res.status).toBe(400);
  });

  it("סימון כנקראה ומחיקה - רק בתיבה של המשתמשת", async () => {
    const sent = await api()
      .post("/api/messages")
      .set(await auth("principal"))
      .send({ title: "לכל המורות", body: "ישיבת צוות ביום שני", audience: "TEACHERS" });
    const cohen = await auth("teacherCohen");
    const english = await auth("teacherEnglish");

    const before = await api().get("/api/messages").set(cohen);
    expect(before.body.items.find((m: { id: number }) => m.id === sent.body.id).isRead).toBe(false);

    expect((await api().patch(`/api/messages/${sent.body.id}/read`).set(cohen)).status).toBe(204);
    const after = await api().get("/api/messages").set(cohen);
    expect(after.body.items.find((m: { id: number }) => m.id === sent.body.id).isRead).toBe(true);
    expect(after.body.unreadCount).toBe(before.body.unreadCount - 1);

    expect((await api().delete(`/api/messages/${sent.body.id}`).set(cohen)).status).toBe(204);
    const gone = await api().get("/api/messages").set(cohen);
    expect(gone.body.items.some((m: { id: number }) => m.id === sent.body.id)).toBe(false);
    const stillThere = await api().get("/api/messages").set(english);
    expect(stillThere.body.items.some((m: { id: number }) => m.id === sent.body.id)).toBe(true);

    // תלמידה לא קיבלה הודעה למורות - לא יכולה לסמן אותה
    expect((await api().patch(`/api/messages/${sent.body.id}/read`).set(await auth("studentYounger"))).status).toBe(404);

    const sentList = await api().get("/api/messages/sent").set(await auth("principal"));
    const mine = sentList.body.find((m: { id: number }) => m.id === sent.body.id);
    expect(mine.readCount).toBe(1);
  });

  it("סימון כל ההודעות כנקראו", async () => {
    const headers = await auth("teacherEnglish");
    await api().patch("/api/messages/read-all").set(headers);
    const res = await api().get("/api/messages").set(headers);
    expect(res.body.unreadCount).toBe(0);
  });
});

describe("ימי הולדת", () => {
  it("מורה רואה ברכות לתלמידות שלה לפי התאריך העברי", async () => {
    const { younger } = await demoIds();
    // יום ההולדת העברי של חיה גולדברג בשנה הנוכחית
    const birth = new HDate(new Date(younger.birthDate!.getUTCFullYear(), younger.birthDate!.getUTCMonth(), younger.birthDate!.getUTCDate()));
    const thisYear = new HDate(birth.getDate(), birth.getMonth(), 5787).greg();
    const date = `${thisYear.getFullYear()}-${String(thisYear.getMonth() + 1).padStart(2, "0")}-${String(thisYear.getDate()).padStart(2, "0")}`;

    const teacher = await api().get(`/api/birthdays/today?date=${date}`).set(await auth("teacherCohen"));
    expect(teacher.status).toBe(200);
    const item = teacher.body.items.find((i: { studentId: number }) => i.studentId === younger.id);
    expect(item.greeting).toBe("מזל טוב לחיה גולדברג מכיתה ד'1 ליום הולדתה!");

    const student = await api().get(`/api/birthdays/today?date=${date}`).set(await auth("studentYounger"));
    expect(student.body.isMyBirthday).toBe(true);
    expect(student.body.items[0].greeting).toBe("מזל טוב, חיה! יום הולדת שמח!");

    // מורה שלא מלמדת בכיתה - לא רואה
    const sister = await api().get(`/api/birthdays/today?date=${date}`).set(await auth("studentOlder"));
    expect(sister.body.isMyBirthday).toBe(false);
    expect(sister.body.items).toHaveLength(0);
  });

  it("בנתוני ההדגמה יש תלמידה בד'1 שחוגגת היום", async () => {
    const res = await api().get("/api/birthdays/today").set(await auth("teacherCohen"));
    expect(res.body.items.length).toBeGreaterThan(0);
  });
});

describe("ייצוא", () => {
  it("רשימת תלמידות CSV עם עברית", async () => {
    const { classD1 } = await demoIds();
    const res = await api().get(`/api/exports/students.csv?classId=${classD1.id}`).set(await auth("teacherCohen"));
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("students.csv");
    expect(res.text.charCodeAt(0)).toBe(0xfeff);
    expect(res.text).toContain("שם פרטי,שם משפחה,תעודת זהות,כיתה");
    expect(res.text).toContain("גולדברג");
    expect(res.text.trim().split("\r\n").length).toBeGreaterThan(20);
  });

  it("מורה מקבלת רק את התלמידות שלה, ומורה שלא מלמדת בכיתה מקבלת 403", async () => {
    const { classD1, classD2 } = await demoIds();
    const headers = await auth("teacherCohen");
    const res = await api().get("/api/exports/students.csv").set(headers);
    const classStudents = await api().get(`/api/classes/${classD1.id}/students`).set(headers);
    expect(res.text.trim().split("\r\n").length - 1).toBe(classStudents.body.length);
    expect((await api().get(`/api/exports/students.csv?classId=${classD2.id}`).set(await auth("teacherCohen"))).status).toBe(403);
  });

  it("קובץ ציונים: שם, כיתה, מבחנים, תקופות ושנתי", async () => {
    const { cohenDinim } = await demoIds();
    const res = await api().get(`/api/exports/grades.csv?assignmentId=${cohenDinim.id}`).set(await auth("teacherCohen"));
    expect(res.status).toBe(200);
    const [header, first] = res.text.replace("﻿", "").split("\r\n");
    expect(header).toContain("שם פרטי,שם משפחה,כיתה");
    expect(header).toContain("ציון מחצית א' (50%)");
    expect(header).toContain("ציון שנתי");
    expect(first).toContain("ד'1");
    expect(first).toContain("לא הושלם");
  });

  it("רשימת מורות - למנהלת בלבד", async () => {
    const ok = await api().get("/api/exports/teachers.csv").set(await auth("principal"));
    expect(ok.text).toContain("הורוביץ");
    expect(ok.text).toContain("אנגלית ד'1");
    expect((await api().get("/api/exports/teachers.csv").set(await auth("teacherCohen"))).status).toBe(403);
  });
});
