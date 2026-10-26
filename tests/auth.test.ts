import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { ACCOUNTS, api, auth, demoIds, prisma } from "./helpers.js";

describe("התחברות ו־JWT", () => {
  it("GET /api/health עובד בלי Token", async () => {
    const res = await api().get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", database: "ok" });
  });

  it("התחברות תקינה מחזירה Token ופרטי משתמשת בלי סיסמה", async () => {
    const res = await api().post("/api/auth/login").send(ACCOUNTS.principal);
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.expiresIn).toBe("1h");
    expect(res.body.user).toMatchObject({ role: "PRINCIPAL", firstName: "רחל" });
    expect(res.body.user.school.name).toContain("עטרת שרה");
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  it("המייל לא תלוי באותיות גדולות/קטנות", async () => {
    const res = await api().post("/api/auth/login").send({ ...ACCOUNTS.principal, email: ACCOUNTS.principal.email.toUpperCase() });
    expect(res.status).toBe(200);
  });

  it("סיסמה שגויה מחזירה 401", async () => {
    const res = await api().post("/api/auth/login").send({ email: ACCOUNTS.principal.email, password: "wrong-password" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("מייל שלא קיים מחזיר 401 עם אותה הודעה", async () => {
    const res = await api().post("/api/auth/login").send({ email: "nobody@example.com", password: "x" });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("מייל או סיסמה שגויים");
  });

  it("בקשת התחברות לא תקינה מחזירה 400", async () => {
    const res = await api().post("/api/auth/login").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it("אחיות עם אותו מייל: הסיסמה קובעת מי נכנסה", async () => {
    const younger = await api().post("/api/auth/login").send(ACCOUNTS.studentYounger);
    const older = await api().post("/api/auth/login").send(ACCOUNTS.studentOlder);
    expect(younger.body.user.firstName).toBe("חיה");
    expect(younger.body.user.class.name).toBe("ד'1");
    expect(older.body.user.firstName).toBe("רחל");
    expect(older.body.user.class.name).toBe("ה'1");
  });

  it("GET /api/auth/me מחזיר את המשתמשת לפי ה־Token", async () => {
    const res = await api().get("/api/auth/me").set(await auth("teacherCohen"));
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ firstName: "מרים", lastName: "כהן", role: "TEACHER" });
  });

  it("בלי Token מחזיר 401", async () => {
    const res = await api().get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("Token לא תקין מחזיר 401", async () => {
    const res = await api().get("/api/auth/me").set("Authorization", "Bearer not.a.token");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });

  it("Token עם חתימה של מפתח אחר מחזיר 401", async () => {
    const forged = jwt.sign({ role: "PRINCIPAL", schoolId: 1 }, "another-secret-another-secret-123456", { subject: "1" });
    const res = await api().get("/api/auth/me").set("Authorization", `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it("Token שפג תוקפו מחזיר 401 TOKEN_EXPIRED", async () => {
    const { cohen } = await demoIds();
    const expired = jwt.sign(
      { role: "TEACHER", schoolId: cohen.schoolId, exp: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_SECRET!,
      { subject: String(cohen.id) },
    );
    const res = await api().get("/api/auth/me").set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("TOKEN_EXPIRED");
  });

  it("משתמשת מושבתת לא יכולה להתחבר, וה־Token שלה מפסיק לעבוד", async () => {
    const res = await api()
      .post("/api/users")
      .set(await auth("principal"))
      .send({ role: "TEACHER", firstName: "זמנית", lastName: "לבדיקה", email: "temp.teacher@example.com", password: "Temp1234" });
    expect(res.status).toBe(201);
    const login = await api().post("/api/auth/login").send({ email: "temp.teacher@example.com", password: "Temp1234" });
    expect(login.status).toBe(200);

    await prisma.user.update({ where: { id: res.body.user.id }, data: { isActive: false } });
    const again = await api().post("/api/auth/login").send({ email: "temp.teacher@example.com", password: "Temp1234" });
    expect(again.status).toBe(401);
    const me = await api().get("/api/auth/me").set("Authorization", `Bearer ${login.body.token}`);
    expect(me.status).toBe(401);
  });

  it("שינוי סיסמה: דורש סיסמה נוכחית נכונה ולא מתנגש עם אחות", async () => {
    const login = await api().post("/api/auth/login").send(ACCOUNTS.studentOlder);
    const headers = { Authorization: `Bearer ${login.body.token}` };

    const wrong = await api().patch("/api/auth/me/password").set(headers).send({ currentPassword: "nope", newPassword: "Something1" });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe("WRONG_PASSWORD");

    // אותה סיסמה כמו של האחות עם אותו מייל - אסור
    const clash = await api()
      .patch("/api/auth/me/password")
      .set(headers)
      .send({ currentPassword: ACCOUNTS.studentOlder.password, newPassword: ACCOUNTS.studentYounger.password });
    expect(clash.status).toBe(409);

    const ok = await api()
      .patch("/api/auth/me/password")
      .set(headers)
      .send({ currentPassword: ACCOUNTS.studentOlder.password, newPassword: "NewPass123" });
    expect(ok.status).toBe(204);
    const relogin = await api().post("/api/auth/login").send({ email: ACCOUNTS.studentOlder.email, password: "NewPass123" });
    expect(relogin.body.user.firstName).toBe("רחל");

    // מחזירים את הסיסמה המקורית לשאר הבדיקות
    await api()
      .patch("/api/auth/me/password")
      .set(headers)
      .send({ currentPassword: "NewPass123", newPassword: ACCOUNTS.studentOlder.password });
  });
});
