import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { api, auth, demoIds } from "./helpers.js";

describe("משתמשות (מנהלת)", () => {
  it("רשימה עם עימוד וסינון לפי תפקיד", async () => {
    const res = await api().get("/api/users?role=TEACHER&pageSize=5").set(await auth("principal"));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(5);
    expect(res.body.total).toBeGreaterThanOrEqual(9);
    expect(res.body.items.every((u: { role: string }) => u.role === "TEACHER")).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("חיפוש לפי שם פרטי, שם משפחה וחיפוש חופשי", async () => {
    const headers = await auth("principal");
    const byLast = await api().get(`/api/users?lastName=${encodeURIComponent("גולדברג")}`).set(headers);
    expect(byLast.body.items.map((u: { firstName: string }) => u.firstName).sort()).toEqual(["חיה", "רחל"].sort());

    const byFirst = await api().get(`/api/users?firstName=${encodeURIComponent("מרים")}&role=TEACHER`).set(headers);
    expect(byFirst.body.items[0].lastName).toBe("כהן");

    const free = await api().get(`/api/users?search=${encodeURIComponent("חיה גולדברג")}`).set(headers);
    expect(free.body.total).toBe(1);
  });

  it("סינון תלמידות לפי כיתה ומיון לפי שם פרטי", async () => {
    const { classD1 } = await demoIds();
    const res = await api()
      .get(`/api/users?role=STUDENT&classId=${classD1.id}&sortBy=firstName&pageSize=100`)
      .set(await auth("principal"));
    expect(res.body.total).toBe(23);
    const names = res.body.items.map((u: { firstName: string }) => u.firstName);
    expect(names).toEqual([...names].sort((a: string, b: string) => a.localeCompare(b, "he")));
  });

  it("פרמטר מיון לא תקין מחזיר 400", async () => {
    const res = await api().get("/api/users?sortBy=password").set(await auth("principal"));
    expect(res.status).toBe(400);
  });

  it("יצירת תלמידה בלי סיסמה - השרת יוצר סיסמה אקראית", async () => {
    const { classD2 } = await demoIds();
    const res = await api()
      .post("/api/users")
      .set(await auth("principal"))
      .send({
        role: "STUDENT",
        firstName: "נעמי",
        lastName: "חדשה",
        idNumber: "400000014",
        email: "new.family@example.com",
        phone: "050-1234567",
        address: "רחוב הבדיקה 1",
        birthDate: "2017-04-02",
        classId: classD2.id,
      });
    expect(res.status).toBe(201);
    expect(res.body.generatedPassword).toMatch(/^[a-z0-9]{8}$/);
    expect(res.body.user).toMatchObject({ firstName: "נעמי", class: { name: "ד'2" }, birthDate: "2017-04-02" });
    expect(res.body.user.hebrewBirthDate).toBeTruthy();

    const login = await api().post("/api/auth/login").send({ email: "new.family@example.com", password: res.body.generatedPassword });
    expect(login.status).toBe(200);
  });

  it("ולידציה: לתלמידה חובה כיתה ותאריך לידה, ומייל תקין", async () => {
    const res = await api()
      .post("/api/users")
      .set(await auth("principal"))
      .send({ role: "STUDENT", firstName: "א", lastName: "ב", email: "bad" });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(["firstName", "lastName", "email", "classId", "birthDate", "idNumber"]));
  });

  it("תאריך לידה בעתיד נדחה", async () => {
    const { classD2 } = await demoIds();
    const res = await api()
      .post("/api/users")
      .set(await auth("principal"))
      .send({ role: "STUDENT", firstName: "עתידית", lastName: "בדיקה", idNumber: "400000022", email: "f@example.com", birthDate: "2099-01-01", classId: classD2.id });
    expect(res.status).toBe(400);
  });

  it("אי אפשר לתת לאחות את אותה סיסמה כמו לאחות עם אותו מייל (409)", async () => {
    const { classD2 } = await demoIds();
    const res = await api()
      .post("/api/users")
      .set(await auth("principal"))
      .send({
        role: "STUDENT",
        firstName: "שלישית",
        lastName: "גולדברג",
        idNumber: "400000030",
        email: "goldberg.family@example.com",
        password: "Demo1234!",
        birthDate: "2017-05-05",
        classId: classD2.id,
      });
    expect(res.status).toBe(409);
  });

  it("עריכה, העברת כיתה והשבתה", async () => {
    const headers = await auth("principal");
    const { classD1, classD2 } = await demoIds();
    const created = await api()
      .post("/api/users")
      .set(headers)
      .send({ role: "STUDENT", firstName: "מעבר", lastName: "כיתה", idNumber: "400000048", email: "move@example.com", birthDate: "2017-01-01", classId: classD1.id });
    const id = created.body.user.id;

    const moved = await api().patch(`/api/users/${id}`).set(headers).send({ classId: classD2.id, phone: "052-9998887" });
    expect(moved.status).toBe(200);
    expect(moved.body.class.name).toBe("ד'2");
    expect(moved.body.phone).toBe("052-9998887");

    const disabled = await api().patch(`/api/users/${id}`).set(headers).send({ isActive: false });
    expect(disabled.body.isActive).toBe(false);

    const list = await api().get(`/api/users?search=${encodeURIComponent("מעבר")}`).set(headers);
    expect(list.body.total).toBe(0);
    const all = await api().get(`/api/users?search=${encodeURIComponent("מעבר")}&isActive=all`).set(headers);
    expect(all.body.total).toBe(1);
  });

  it("מנהלת לא יכולה להשבית את עצמה", async () => {
    const me = await api().get("/api/auth/me").set(await auth("principal"));
    const res = await api().patch(`/api/users/${me.body.user.id}`).set(await auth("principal")).send({ isActive: false });
    expect(res.status).toBe(400);
  });

  it("איפוס סיסמה מחזיר סיסמה חדשה שעובדת", async () => {
    const { english } = await demoIds();
    const res = await api().post(`/api/users/${english.id}/reset-password`).set(await auth("principal")).send({});
    expect(res.status).toBe(200);
    const login = await api().post("/api/auth/login").send({ email: english.email, password: res.body.temporaryPassword });
    expect(login.status).toBe(200);
    // מחזירים את סיסמת ההדגמה
    await api().post(`/api/users/${english.id}/reset-password`).set(await auth("principal")).send({ password: "Demo1234!" });
  });
});

describe("ייבוא תלמידות מאקסל", () => {
  async function buildFile(rows: Array<Array<string | Date>>) {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("תלמידות");
    sheet.addRow(["שם פרטי", "שם משפחה", "תעודת זהות", "מייל", "טלפון", "כתובת", "תאריך לידה", "כיתה"]);
    rows.forEach((r) => sheet.addRow(r));
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  it("מוריד קובץ לדוגמה", async () => {
    const res = await api().get("/api/users/import/template.xlsx").set(await auth("principal")).buffer(true).parse(binaryParser);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("spreadsheetml");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as Buffer);
    expect(wb.worksheets[0]!.getRow(1).getCell(1).value).toBe("שם פרטי");
  });

  it("קובץ עם שגיאות - לא נשמר כלום ומוחזרות שגיאות לפי שורה", async () => {
    const headers = await auth("principal");
    const file = await buildFile([
      ["טובה", "שגיאות", "400000055", "errors.family@example.com", "", "", "15/03/2017", "ד'1"],
      ["", "בלי שם", "400000063", "errors.family@example.com", "", "", "15/03/2017", "ד'1"],
      ["מלכה", "שגיאות", "000180000", "errors.family@example.com", "", "", "31/02/2017", "ד'9"],
    ]);
    const res = await api().post("/api/users/import").set(headers).attach("file", file, "students.xlsx");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("IMPORT_VALIDATION_ERROR");
    const rows = res.body.error.details.map((d: { row: number }) => d.row);
    expect(rows).toEqual(expect.arrayContaining([3, 4]));
    expect(rows).not.toContain(2);

    const check = await api().get(`/api/users?lastName=${encodeURIComponent("שגיאות")}`).set(headers);
    expect(check.body.total).toBe(0);
  });

  it("קובץ תקין - כל התלמידות נוספות, ואפשר להוריד קובץ סיסמאות פעם אחת", async () => {
    const headers = await auth("principal");
    const file = await buildFile([
      ["אסתר", "ייבוא", "400000055", "import.family@example.com", "050-1111111", "רחוב א 1", "15/03/2017", "ד'1"],
      ["שושנה", "ייבוא", "400000063", "import.family@example.com", "050-1111111", "רחוב א 1", new Date(Date.UTC(2016, 0, 20)), "ה1"],
    ]);
    const res = await api().post("/api/users/import").set(headers).attach("file", file, "students.xlsx");
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(2);
    const [a, b] = res.body.students;
    expect(a.className).toBe("ד'1");
    expect(b.className).toBe("ה'1");
    expect(a.password).not.toBe(b.password);

    const loginB = await api().post("/api/auth/login").send({ email: "import.family@example.com", password: b.password });
    expect(loginB.body.user.firstName).toBe("שושנה");

    const download = await api()
      .get(`/api/users/import/${res.body.importId}/passwords.xlsx`)
      .set(headers)
      .buffer(true)
      .parse(binaryParser);
    expect(download.status).toBe(200);
    const again = await api().get(`/api/users/import/${res.body.importId}/passwords.xlsx`).set(headers);
    expect(again.status).toBe(404);

    // אותו קובץ שוב - כפילות
    const dup = await api().post("/api/users/import").set(headers).attach("file", file, "students.xlsx");
    expect(dup.status).toBe(400);
  });

  it("קובץ שאינו אקסל נדחה", async () => {
    const res = await api()
      .post("/api/users/import")
      .set(await auth("principal"))
      .attach("file", Buffer.from("hello"), "notes.txt");
    expect(res.status).toBe(400);
  });
});

function binaryParser(res: NodeJS.ReadableStream & { setEncoding(e: string): void }, callback: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on("data", (chunk: Buffer) => chunks.push(chunk));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
}
