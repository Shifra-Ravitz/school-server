import { describe, expect, it } from "vitest";
import { api, auth, demoIds } from "./helpers.js";

/** בדיקות הרשאה: 403 לתפקיד לא מתאים, ו־404 לנתונים של בית ספר אחר */
describe("הרשאות", () => {
  it("תלמידה לא יכולה לראות רשימת משתמשות (403)", async () => {
    const res = await api().get("/api/users").set(await auth("studentYounger"));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("מורה לא יכולה ליצור משתמשות (403)", async () => {
    const res = await api()
      .post("/api/users")
      .set(await auth("teacherCohen"))
      .send({ role: "TEACHER", firstName: "אין", lastName: "הרשאה", email: "x@example.com" });
    expect(res.status).toBe(403);
  });

  it("מורה לא יכולה לגשת לשיבוץ של מורה אחרת (403)", async () => {
    const { levyDinim } = await demoIds();
    const res = await api().get(`/api/assignments/${levyDinim.id}/exams`).set(await auth("teacherCohen"));
    expect(res.status).toBe(403);
  });

  it("מורה לא יכולה לראות כיתה שהיא לא מלמדת בה (403)", async () => {
    const { classD2 } = await demoIds();
    const res = await api().get(`/api/classes/${classD2.id}/students`).set(await auth("teacherCohen"));
    expect(res.status).toBe(403);
  });

  it("מורה רואה רק את הכיתות והשיבוצים שלה", async () => {
    const classes = await api().get("/api/classes").set(await auth("teacherCohen"));
    expect(classes.body.map((c: { name: string }) => c.name)).toEqual(["ד'1"]);
    const english = await api().get("/api/classes").set(await auth("teacherEnglish"));
    expect(english.body).toHaveLength(4);

    const assignments = await api().get("/api/assignments").set(await auth("teacherCohen"));
    const subjects = assignments.body.map((a: { subject: { name: string } }) => a.subject.name).sort();
    expect(subjects).toEqual(["דינים", "חומש", "לשון", "נביא"].sort());
  });

  it("מורה לא יכולה לסנן לפי מורה אחרת כדי לראות את השיבוצים שלה", async () => {
    const { english } = await demoIds();
    const res = await api().get(`/api/assignments?teacherId=${english.id}`).set(await auth("teacherCohen"));
    expect(res.status).toBe(200);
    expect(res.body.every((a: { teacher: { id: number } }) => a.teacher.id !== english.id)).toBe(true);
  });

  it("מנהלת לא רואה נתונים של בית ספר אחר (404)", async () => {
    const { otherClass, otherAssignment, classD1 } = await demoIds();
    const headers = await auth("principal");
    expect((await api().get(`/api/classes/${otherClass.id}`).set(headers)).status).toBe(404);
    expect((await api().get(`/api/assignments/${otherAssignment.id}/exams`).set(headers)).status).toBe(404);

    const other = await auth("otherPrincipal");
    expect((await api().get(`/api/classes/${classD1.id}/students`).set(other)).status).toBe(404);
    const users = await api().get("/api/users?pageSize=100").set(other);
    expect(users.body.total).toBe(9); // מנהלת + 2 מורות + 6 תלמידות
  });

  it("מנהלת לא יכולה לערוך משתמשת של בית ספר אחר (404)", async () => {
    const { younger } = await demoIds();
    const res = await api().patch(`/api/users/${younger.id}`).set(await auth("otherPrincipal")).send({ firstName: "פריצה" });
    expect(res.status).toBe(404);
  });

  it("אזור התלמידה פתוח רק לתלמידות", async () => {
    expect((await api().get("/api/me/grades").set(await auth("teacherCohen"))).status).toBe(403);
    expect((await api().get("/api/me/grades").set(await auth("studentYounger"))).status).toBe(200);
  });

  it("רק מנהלת שולחת הודעות", async () => {
    const res = await api()
      .post("/api/messages")
      .set(await auth("teacherCohen"))
      .send({ title: "ניסיון", body: "טקסט", audience: "ALL" });
    expect(res.status).toBe(403);
  });

  it("מזהה לא תקין בכתובת מחזיר 400", async () => {
    const res = await api().get("/api/classes/abc").set(await auth("principal"));
    expect(res.status).toBe(400);
  });
});
