import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { isValidIsraeliId } from "../src/utils/validation.js";
import { api, auth, demoIds, prisma } from "./helpers.js";

describe("תעודת זהות", () => {
  it("בדיקת ספרת ביקורת", () => {
    expect(isValidIsraeliId("123456782")).toBe(true);
    expect(isValidIsraeliId("123456789")).toBe(false);
    expect(isValidIsraeliId("12345678a")).toBe(false);
  });

  it("לכל תלמידות ההדגמה יש תעודת זהות תקינה וייחודית", async () => {
    const students = await prisma.user.findMany({ where: { role: "STUDENT" }, select: { idNumber: true } });
    const ids = students.map((s) => s.idNumber);
    expect(ids.every((id) => id && isValidIsraeliId(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("מופיעה ברשימת התלמידות ובחיפוש", async () => {
    const { classD1, younger } = await demoIds();
    const headers = await auth("teacherCohen");
    const list = await api().get(`/api/classes/${classD1.id}/students`).set(headers);
    expect(list.body[0].idNumber).toMatch(/^\d{9}$/);
    const search = await api().get(`/api/users?search=${younger.idNumber}`).set(await auth("principal"));
    expect(search.body.items.map((u: { id: number }) => u.id)).toEqual([younger.id]);
  });

  it("יצירת תלמידה: חובה, נבדקת, ולא כפולה", async () => {
    const { classD2, younger } = await demoIds();
    const headers = await auth("principal");
    const base = { role: "STUDENT", firstName: "זהות", lastName: "בדיקה", email: "id.test@example.com", birthDate: "2017-02-02", classId: classD2.id };

    const missing = await api().post("/api/users").set(headers).send(base);
    expect(missing.status).toBe(400);
    expect(missing.body.error.details.map((d: { field: string }) => d.field)).toContain("idNumber");

    const invalid = await api().post("/api/users").set(headers).send({ ...base, idNumber: "123456789" });
    expect(invalid.status).toBe(400);

    const dup = await api().post("/api/users").set(headers).send({ ...base, idNumber: younger.idNumber });
    expect(dup.status).toBe(409);

    const ok = await api().post("/api/users").set(headers).send({ ...base, idNumber: "123456782" });
    expect(ok.status).toBe(201);
    expect(ok.body.user.idNumber).toBe("123456782");

    // משלים אפסים מובילים: 180000 → 000180000
    const short = await api().post("/api/users").set(headers).send({ ...base, email: "id.short@example.com", idNumber: "180000" });
    expect(short.status).toBe(201);
    expect(short.body.user.idNumber).toBe("000180000");
  });

  it("נכללת בייצוא ובייבוא", async () => {
    const { classD1 } = await demoIds();
    const csv = await api().get(`/api/exports/students.csv?classId=${classD1.id}`).set(await auth("principal"));
    expect(csv.text).toContain("תעודת זהות");

    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("תלמידות");
    sheet.addRow(["שם פרטי", "שם משפחה", "תעודת זהות", "מייל", "טלפון", "כתובת", "תאריך לידה", "כיתה"]);
    sheet.addRow(["נחמה", "זהות", "123456789", "z.family@example.com", "", "", "01/01/2017", "ד'1"]);
    const res = await api()
      .post("/api/users/import")
      .set(await auth("principal"))
      .attach("file", Buffer.from(await wb.xlsx.writeBuffer()), "s.xlsx");
    expect(res.status).toBe(400);
    expect(res.body.error.details[0]).toMatchObject({ row: 2, field: "תעודת זהות" });
  });
});

describe("שמירת טבלת ציונים בבקשה אחת", () => {
  it("שומרת כמה מבחנים וכמה תלמידות ומחזירה את הטבלה המעודכנת", async () => {
    const { cohenChumash } = await demoIds();
    const headers = await auth("teacherCohen");
    const before = await api().get(`/api/assignments/${cohenChumash.id}/final-grades`).set(headers);
    const exams = before.body.periods[0].exams as Array<{ id: number }>;
    const [s1, s2] = before.body.students as Array<{ studentId: number }>;

    const res = await api()
      .put(`/api/assignments/${cohenChumash.id}/grades`)
      .set(headers)
      .send({
        grades: [
          { examId: exams[0]!.id, studentId: s1!.studentId, score: 99.5, evaluation: "מצוין" },
          { examId: exams[1]!.id, studentId: s1!.studentId, score: 91 },
          { examId: exams[0]!.id, studentId: s2!.studentId, score: null },
        ],
      });
    expect(res.status).toBe(200);
    const r1 = res.body.students.find((s: { studentId: number }) => s.studentId === s1!.studentId);
    const r2 = res.body.students.find((s: { studentId: number }) => s.studentId === s2!.studentId);
    expect(r1.scores[String(exams[0]!.id)]).toBe(99.5);
    expect(r1.evaluations[String(exams[0]!.id)]).toBe("מצוין");
    expect(r1.scores[String(exams[1]!.id)]).toBe(91);
    expect(r2.scores[String(exams[0]!.id)]).toBeNull();
  });

  it("דוחה מבחן משיבוץ אחר ותלמידה מכיתה אחרת", async () => {
    const { cohenChumash, cohenDinim, older } = await demoIds();
    const headers = await auth("teacherCohen");
    const otherExam = await prisma.exam.findFirstOrThrow({ where: { period: { assignmentId: cohenDinim.id } } });
    const myExam = await prisma.exam.findFirstOrThrow({ where: { period: { assignmentId: cohenChumash.id } } });
    const students = await api().get(`/api/assignments/${cohenChumash.id}/final-grades`).set(headers);
    const sid = students.body.students[0].studentId;

    const wrongExam = await api()
      .put(`/api/assignments/${cohenChumash.id}/grades`)
      .set(headers)
      .send({ grades: [{ examId: otherExam.id, studentId: sid, score: 80 }] });
    expect(wrongExam.status).toBe(400);

    const wrongStudent = await api()
      .put(`/api/assignments/${cohenChumash.id}/grades`)
      .set(headers)
      .send({ grades: [{ examId: myExam.id, studentId: older.id, score: 80 }] });
    expect(wrongStudent.status).toBe(400);
  });

  it("מורה לא יכולה לשמור ציונים בשיבוץ של מורה אחרת", async () => {
    const { englishD1 } = await demoIds();
    const exam = await prisma.exam.findFirstOrThrow({ where: { period: { assignmentId: englishD1.id } } });
    const res = await api()
      .put(`/api/assignments/${englishD1.id}/grades`)
      .set(await auth("teacherCohen"))
      .send({ grades: [{ examId: exam.id, studentId: 1, score: 80 }] });
    expect(res.status).toBe(403);
  });
});
