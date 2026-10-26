import { HDate, HebrewCalendar } from "@hebcal/core";

/**
 * תאריכים בלי שעה (תאריך לידה, תאריך מבחן, תאריך שיעור) נשמרים במסד הנתונים
 * כחצות לפי UTC. הפונקציות כאן ממירות ביניהם לבין מחרוזת YYYY-MM-DD.
 */

export function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** התאריך של היום בישראל, בפורמט YYYY-MM-DD */
export function todayInIsrael(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** יום בשבוע לפי המערכת שלנו: 1 = ראשון ... 6 = שישי, 7 = שבת */
export function dayOfWeekOf(dateOnly: string): number {
  return toDateOnly(dateOnly).getUTCDay() + 1;
}

/** ממיר תאריך שנשמר ב־UTC לתאריך עברי, בלי בעיות של אזורי זמן */
export function toHDate(date: Date): HDate {
  return new HDate(new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// ---------- גימטריה ----------

const ONES = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
const TENS = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
const HUNDREDS = ["", "ק", "ר", "ש", "ת", "תק", "תר", "תש", "תת", "תתק"];

/** מספר (1-999) לאותיות בלי סימני גרש, למשל 15 = "טו", 787 = "תשפז" */
export function numberToHebrewLetters(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 999) return String(n);
  const h = Math.floor(n / 100);
  const rest = n % 100;
  let tail: string;
  if (rest === 15) tail = "טו";
  else if (rest === 16) tail = "טז";
  else tail = (TENS[Math.floor(rest / 10)] ?? "") + (ONES[rest % 10] ?? "");
  return (HUNDREDS[h] ?? "") + tail;
}

/** מוסיף גרש או גרשיים: "ד" → "ד׳", "תשפז" → "תשפ״ז" */
export function withGeresh(letters: string): string {
  if (letters.length === 0) return letters;
  if (letters.length === 1) return `${letters}׳`;
  return `${letters.slice(0, -1)}״${letters.slice(-1)}`;
}

/** תאריך עברי לתצוגה, למשל: י״ב חשון תשע״ז */
export function hebrewDateString(date: Date): string {
  const hd = toHDate(date);
  const day = withGeresh(numberToHebrewLetters(hd.getDate()));
  const year = withGeresh(numberToHebrewLetters(hd.getFullYear() % 1000));
  return `${day} ${hebrewMonthName(hd)} ${year}`;
}

function hebrewMonthName(hd: HDate): string {
  const names: Record<string, string> = {
    Nisan: "ניסן",
    Iyyar: "אייר",
    Sivan: "סיון",
    Tamuz: "תמוז",
    Av: "אב",
    Elul: "אלול",
    Tishrei: "תשרי",
    Cheshvan: "חשון",
    Kislev: "כסלו",
    Tevet: "טבת",
    "Sh'vat": "שבט",
    Adar: "אדר",
    "Adar I": "אדר א׳",
    "Adar II": "אדר ב׳",
  };
  const english = hd.getMonthName();
  return names[english] ?? english;
}

/**
 * האם בתאריך `onDate` חל יום ההולדת העברי של מי שנולדה ב־`birthDate`.
 * הספרייה מטפלת במקרים מיוחדים (אדר בשנה מעוברת, ל׳ חשון וכו׳).
 */
export function isHebrewBirthday(birthDate: Date, onDate: Date): boolean {
  const today = toHDate(onDate);
  const birth = toHDate(birthDate);
  if (birth.abs() > today.abs()) return false;
  const birthday = HebrewCalendar.getBirthdayOrAnniversary(today.getFullYear(), birth);
  return birthday !== undefined && birthday.isSameDate(today);
}

/** גיל בשנים עבריות בתאריך מסוים */
export function hebrewAge(birthDate: Date, onDate: Date): number {
  return toHDate(onDate).getFullYear() - toHDate(birthDate).getFullYear();
}

/**
 * שנת הלימודים הנוכחית, למשל "תשפ״ז".
 * שנת הלימודים מתחילה בספטמבר, ולכן מאוגוסט ואילך כבר עוברים לשנה הבאה.
 */
export function currentSchoolYear(now: Date = new Date()): string {
  const year = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  // 1 בנובמבר תמיד נמצא כבר בשנה העברית החדשה (ראש השנה חל לכל המאוחר בתחילת אוקטובר)
  const hYear = new HDate(new Date(year, 10, 1)).getFullYear();
  return withGeresh(numberToHebrewLetters(hYear % 1000));
}
