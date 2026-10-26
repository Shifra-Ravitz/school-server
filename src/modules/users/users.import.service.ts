import ExcelJS from "exceljs";
import { randomUUID } from "node:crypto";
import { prisma } from "../../db/prisma.js";
import type { AuthUser } from "../../types/express.js";
import { classDisplayName, parseClassName } from "../../utils/classNames.js";
import { currentSchoolYear, toDateOnly, todayInIsrael } from "../../utils/dates.js";
import { AppError, notFound } from "../../utils/errors.js";
import { generatePassword, hashPassword, isPasswordTakenForEmail } from "../../utils/passwords.js";
import { isValidIsraeliId } from "../../utils/validation.js";

/**
 * ייבוא תלמידות מקובץ אקסל.
 * כל השורות נבדקות לפני ששומרים משהו. אם יש אפילו שגיאה אחת - לא נשמר כלום,
 * ומוחזרת רשימת שגיאות לפי מספר שורה, כדי שהמנהלת תתקן ותעלה שוב.
 */

const COLUMNS = [
  { key: "firstName", header: "שם פרטי", required: true, width: 16 },
  { key: "lastName", header: "שם משפחה", required: true, width: 16 },
  { key: "idNumber", header: "תעודת זהות", required: true, width: 13 },
  { key: "email", header: "מייל", required: true, width: 30 },
  { key: "phone", header: "טלפון", required: false, width: 15 },
  { key: "address", header: "כתובת", required: false, width: 30 },
  { key: "birthDate", header: "תאריך לידה", required: true, width: 14 },
  { key: "className", header: "כיתה", required: true, width: 10 },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];
const MAX_ROWS = 1000;

export interface ImportError {
  row: number;
  field: string | null;
  message: string;
}

// ---------- קובץ לדוגמה ----------

export async function buildTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("תלמידות", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  sheet.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  sheet.getRow(1).font = { bold: true };
  sheet.getColumn("birthDate").numFmt = "dd/mm/yyyy";

  const help = wb.addWorksheet("הוראות", { views: [{ rightToLeft: true }] });
  help.getColumn(1).width = 90;
  [
    "איך ממלאים את הקובץ:",
    "1. כל שורה בגיליון 'תלמידות' היא תלמידה אחת. לא משנים את שורת הכותרות.",
    "2. שדות חובה: שם פרטי, שם משפחה, תעודת זהות, מייל, תאריך לידה, כיתה.",
    "3. מייל: אפשר מייל של ההורים. אחיות יכולות לקבל אותו מייל.",
    "4. תאריך לידה: תאריך לועזי, למשל 15/03/2017.",
    "5. כיתה: כפי שמופיעה במערכת, למשל ד'1 או ה2. הכיתה צריכה להיות קיימת במערכת.",
    "6. לכל תלמידה תיווצר סיסמה אקראית. אחרי הייבוא אפשר להוריד קובץ עם כל הסיסמאות.",
    "3א. תעודת זהות: 9 ספרות, כולל ספרת ביקורת.",
    "דוגמה לשורה: רבקה | כהן | 123456782 | cohen.family@example.com | 050-1234567 | רחוב הדוגמה 5 | 15/03/2017 | ד'1",
  ].forEach((line, i) => {
    help.getCell(i + 1, 1).value = line;
  });
  help.getRow(1).font = { bold: true };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ---------- קריאת הקובץ ----------

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim(); // קישור
    if ("richText" in value) return value.richText.map((r) => r.text).join("").trim();
    if ("result" in value && value.result !== undefined) return cellToString(value.result as ExcelJS.CellValue);
    return "";
  }
  return String(value).trim();
}

/** מקבל 15/03/2017, 15.3.2017, 2017-03-15 ומחזיר 2017-03-15 */
function normalizeDate(raw: string): string | null {
  let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
  const local = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(raw);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (local) [d, m, y] = [Number(local[1]), Number(local[2]), Number(local[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[0-9+\-\s]{7,20}$/;

interface ParsedRow {
  row: number;
  firstName: string;
  lastName: string;
  idNumber: string;
  email: string;
  phone: string | null;
  address: string | null;
  birthDate: string;
  classId: number;
  className: string;
}

async function parseWorkbook(auth: AuthUser, buffer: Buffer) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new AppError(400, "INVALID_FILE", "הקובץ אינו קובץ אקסל תקין (xlsx)");
  }
  const sheet = wb.worksheets[0];
  if (!sheet) throw new AppError(400, "INVALID_FILE", "הקובץ ריק");

  // מיפוי עמודות לפי שורת הכותרות
  const columnIndex = new Map<ColumnKey, number>();
  sheet.getRow(1).eachCell((cell, col) => {
    const header = cellToString(cell.value);
    const column = COLUMNS.find((c) => c.header === header);
    if (column) columnIndex.set(column.key, col);
  });
  const missing = COLUMNS.filter((c) => c.required && !columnIndex.has(c.key)).map((c) => c.header);
  if (missing.length > 0) {
    throw new AppError(400, "INVALID_FILE", `חסרות עמודות בקובץ: ${missing.join(", ")}. מומלץ להשתמש בקובץ לדוגמה.`);
  }

  // הכיתות של בית הספר בשנה הנוכחית
  const schoolYear = currentSchoolYear();
  const classes = await prisma.class.findMany({ where: { schoolId: auth.schoolId } });
  const findClass = (gradeLevel: number, parallel: number) => {
    const matches = classes.filter((c) => c.gradeLevel === gradeLevel && c.parallel === parallel);
    return matches.find((c) => c.schoolYear === schoolYear) ?? (matches.length === 1 ? matches[0] : undefined);
  };

  const errors: ImportError[] = [];
  const rows: ParsedRow[] = [];
  const today = todayInIsrael();

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const get = (key: ColumnKey) => {
      const col = columnIndex.get(key);
      return col ? cellToString(row.getCell(col).value) : "";
    };
    const values = Object.fromEntries(COLUMNS.map((c) => [c.key, get(c.key)])) as Record<ColumnKey, string>;
    if (Object.values(values).every((v) => v === "")) continue; // שורה ריקה

    if (rows.length + errors.length >= MAX_ROWS) {
      throw new AppError(400, "INVALID_FILE", `אפשר לייבא עד ${MAX_ROWS} תלמידות בקובץ אחד`);
    }

    const rowErrors: ImportError[] = [];
    const add = (field: ColumnKey, message: string) =>
      rowErrors.push({ row: r, field: COLUMNS.find((c) => c.key === field)!.header, message });

    for (const c of COLUMNS) if (c.required && values[c.key] === "") add(c.key, "שדה חובה");
    if (values.firstName && (values.firstName.length < 2 || values.firstName.length > 40)) add("firstName", "בין 2 ל־40 תווים");
    if (values.lastName && (values.lastName.length < 2 || values.lastName.length > 40)) add("lastName", "בין 2 ל־40 תווים");
    const email = values.email.toLowerCase();
    if (email && !EMAIL_RE.test(email)) add("email", "כתובת מייל לא תקינה");
    if (values.phone && !PHONE_RE.test(values.phone)) add("phone", "מספר טלפון לא תקין");
    if (values.address.length > 200) add("address", "עד 200 תווים");
    const idNumber = values.idNumber.replace(/\D/g, "");
    if (values.idNumber && !isValidIsraeliId(idNumber)) add("idNumber", "מספר תעודת זהות לא תקין");

    let birthDate: string | null = null;
    if (values.birthDate) {
      birthDate = normalizeDate(values.birthDate);
      if (!birthDate) add("birthDate", "תאריך לא תקין. יש לכתוב למשל 15/03/2017");
      else if (birthDate > today) add("birthDate", "תאריך לידה לא יכול להיות בעתיד");
    }

    let classId: number | null = null;
    let className = values.className;
    if (values.className) {
      const parsed = parseClassName(values.className);
      const cls = parsed ? findClass(parsed.gradeLevel, parsed.parallel) : undefined;
      if (!cls) add("className", `הכיתה "${values.className}" לא קיימת במערכת`);
      else {
        classId = cls.id;
        className = classDisplayName(cls.gradeLevel, cls.parallel);
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }
    rows.push({
      row: r,
      firstName: values.firstName,
      lastName: values.lastName,
      idNumber: idNumber.padStart(9, "0"),
      email,
      phone: values.phone || null,
      address: values.address || null,
      birthDate: birthDate!,
      classId: classId!,
      className,
    });
  }

  // אותה תעודת זהות פעמיים בקובץ
  const seenIds = new Map<string, number>();
  for (const row of rows) {
    const first = seenIds.get(row.idNumber);
    if (first) errors.push({ row: row.row, field: "תעודת זהות", message: `תעודת הזהות מופיעה גם בשורה ${first}` });
    else seenIds.set(row.idNumber, row.row);
  }

  // כפילויות בתוך הקובץ
  const seen = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.firstName}|${row.lastName}|${row.email}`;
    const first = seen.get(key);
    if (first) errors.push({ row: row.row, field: null, message: `התלמידה מופיעה פעמיים בקובץ (גם בשורה ${first})` });
    else seen.set(key, row.row);
  }

  // תלמידות שכבר קיימות במערכת
  if (rows.length > 0) {
    const existing = await prisma.user.findMany({
      where: { schoolId: auth.schoolId, role: "STUDENT", email: { in: [...new Set(rows.map((r) => r.email))] } },
      select: { firstName: true, lastName: true, email: true },
    });
    const existingKeys = new Set(existing.map((e) => `${e.firstName}|${e.lastName}|${e.email}`));
    for (const row of rows) {
      if (existingKeys.has(`${row.firstName}|${row.lastName}|${row.email}`)) {
        errors.push({ row: row.row, field: null, message: "תלמידה עם אותו שם ומייל כבר קיימת במערכת" });
      }
    }
    const takenIds = await prisma.user.findMany({
      where: { schoolId: auth.schoolId, idNumber: { in: rows.map((r) => r.idNumber) } },
      select: { idNumber: true },
    });
    const takenSet = new Set(takenIds.map((t) => t.idNumber));
    for (const row of rows) {
      if (takenSet.has(row.idNumber)) {
        errors.push({ row: row.row, field: "תעודת זהות", message: "כבר קיימת במערכת משתמשת עם תעודת זהות זו" });
      }
    }
  }

  if (rows.length === 0 && errors.length === 0) throw new AppError(400, "INVALID_FILE", "לא נמצאו תלמידות בקובץ");
  return { rows, errors: errors.sort((a, b) => a.row - b.row) };
}

// ---------- שמירה ----------

interface CreatedStudent {
  id: number;
  firstName: string;
  lastName: string;
  className: string;
  email: string;
  password: string;
}

interface PendingDownload {
  schoolId: number;
  createdById: number;
  students: CreatedStudent[];
  expiresAt: number;
}

/** קבצי הסיסמאות נשמרים רק בזיכרון, לזמן קצר, ולהורדה אחת בלבד */
const pendingDownloads = new Map<string, PendingDownload>();
const DOWNLOAD_TTL_MS = 30 * 60 * 1000;

export async function importStudents(auth: AuthUser, buffer: Buffer) {
  const { rows, errors } = await parseWorkbook(auth, buffer);
  if (errors.length > 0) {
    throw new AppError(400, "IMPORT_VALIDATION_ERROR", `נמצאו ${errors.length} שגיאות בקובץ. לא נשמר דבר.`, errors);
  }

  // סיסמה אקראית לכל תלמידה, שלא חוזרת אצל משתמשת אחרת עם אותו מייל (כולל אחיות באותו קובץ)
  const usedInFile = new Map<string, Set<string>>();
  const prepared: Array<ParsedRow & { password: string }> = [];
  for (const row of rows) {
    const taken = usedInFile.get(row.email) ?? new Set<string>();
    let password = generatePassword();
    while (taken.has(password) || (await isPasswordTakenForEmail(row.email, password))) password = generatePassword();
    taken.add(password);
    usedInFile.set(row.email, taken);
    prepared.push({ ...row, password });
  }
  const hashes = await Promise.all(prepared.map((p) => hashPassword(p.password)));

  const created = await prisma.$transaction(
    prepared.map((p, i) =>
      prisma.user.create({
        data: {
          schoolId: auth.schoolId,
          role: "STUDENT",
          firstName: p.firstName,
          lastName: p.lastName,
          idNumber: p.idNumber,
          email: p.email,
          phone: p.phone,
          address: p.address,
          birthDate: toDateOnly(p.birthDate),
          classId: p.classId,
          passwordHash: hashes[i]!,
        },
        select: { id: true },
      }),
    ),
  );

  const students: CreatedStudent[] = prepared.map((p, i) => ({
    id: created[i]!.id,
    firstName: p.firstName,
    lastName: p.lastName,
    className: p.className,
    email: p.email,
    password: p.password,
  }));

  cleanupExpired();
  const importId = randomUUID();
  pendingDownloads.set(importId, {
    schoolId: auth.schoolId,
    createdById: auth.id,
    students,
    expiresAt: Date.now() + DOWNLOAD_TTL_MS,
  });

  return { created: students.length, importId, students };
}

function cleanupExpired() {
  const now = Date.now();
  for (const [id, entry] of pendingDownloads) if (entry.expiresAt < now) pendingDownloads.delete(id);
}

/** קובץ אקסל עם הסיסמאות של הייבוא. אפשר להוריד פעם אחת בלבד. */
export async function buildPasswordsFile(auth: AuthUser, importId: string): Promise<Buffer> {
  cleanupExpired();
  const entry = pendingDownloads.get(importId);
  if (!entry || entry.schoolId !== auth.schoolId || entry.createdById !== auth.id) {
    throw notFound("קובץ הסיסמאות (ייתכן שכבר הורד או שפג תוקפו)");
  }
  pendingDownloads.delete(importId);

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("סיסמאות", { views: [{ rightToLeft: true }] });
  sheet.columns = [
    { header: "שם פרטי", key: "firstName", width: 16 },
    { header: "שם משפחה", key: "lastName", width: 16 },
    { header: "כיתה", key: "className", width: 10 },
    { header: "מייל להתחברות", key: "email", width: 30 },
    { header: "סיסמה", key: "password", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };
  entry.students.forEach((s) => sheet.addRow(s));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
