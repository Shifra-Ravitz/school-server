import type { AttendanceStatus, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { HDate, months } from "@hebcal/core";
import { classDisplayName } from "../src/utils/classNames.js";
import { isHebrewBirthday, toDateOnly, todayInIsrael } from "../src/utils/dates.js";
import {
  ABSENCE_REASONS,
  CLASSES,
  DEMO_SISTERS,
  EVALUATIONS,
  EXAM_TITLES,
  FAMILY_NAMES,
  MAIN_SCHOOL,
  NO_SCHOOL_DATES,
  PHONE_PREFIXES,
  PRINCIPAL,
  RELEASE_REASONS,
  SCHOOL_DOMAIN,
  SCHOOL_YEAR_START,
  SECOND_SCHOOL,
  STREETS,
  STUDENT_FIRST_NAMES,
  SUBJECTS,
  TEACHERS,
  WEEKLY_HOURS,
  type SubjectName,
} from "./seed-data.js";

/**
 * יצירת נתוני ההדגמה.
 * הנתונים נוצרים באקראיות קבועה (seed מספרי), כך שבכל הרצה מתקבלים אותם נתונים.
 */

const SCHOOL_YEAR = "תשפ״ז";
const ROUNDS = process.env.NODE_ENV === "test" ? 4 : 10;
const MAX_ATTENDANCE_DAYS = 45;

export interface DemoAccount {
  role: string;
  name: string;
  email: string;
  password: string;
  note: string;
}

export interface SeedResult {
  demoAccounts: DemoAccount[];
  counts: Record<string, number>;
}

// ---------- אקראיות קבועה ----------

function createRandom(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
    chance: (p: number) => next() < p,
  };
}

type Random = ReturnType<typeof createRandom>;

// ---------- עזרי תאריכים ----------

function addDays(date: string, days: number): string {
  const d = toDateOnly(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isSchoolDay(date: string): boolean {
  const dow = toDateOnly(date).getUTCDay(); // 0 = ראשון, 6 = שבת
  return dow !== 6 && !NO_SCHOOL_DATES.has(date);
}

function schoolDaysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (isSchoolDay(d)) days.push(d);
  return days;
}

function pickExamDay(rnd: Random, from: string, to: string): string {
  // מבחנים לא נערכים ביום שישי
  const days = schoolDaysBetween(from, to).filter((d) => toDateOnly(d).getUTCDay() !== 5);
  return rnd.pick(days.length ? days : [from]);
}

function randomDate(rnd: Random, from: string, to: string): string {
  const span = Math.round((toDateOnly(to).getTime() - toDateOnly(from).getTime()) / 86400000);
  return addDays(from, rnd.int(0, span));
}

// ---------- עזרים כלליים ----------

function phone(rnd: Random): string {
  const prefix = rnd.pick(PHONE_PREFIXES);
  return prefix === "03" ? `03-${rnd.int(5000000, 6999999)}` : `${prefix}-${rnd.int(1000000, 9999999)}`;
}

/** תעודת זהות מומצאת עם ספרת ביקורת תקינה, ייחודית בכל ההרצה */
const usedIdNumbers = new Set<string>();
function idNumber(rnd: Random): string {
  for (;;) {
    let base = String(rnd.int(20000000, 39999999)); // 8 ספרות
    let sum = 0;
    for (let i = 0; i < 8; i++) {
      let d = Number(base[i]) * ((i % 2) + 1);
      if (d > 9) d -= 9;
      sum += d;
    }
    base += String((10 - (sum % 10)) % 10);
    if (!usedIdNumbers.has(base)) {
      usedIdNumbers.add(base);
      return base;
    }
  }
}

function address(rnd: Random, city: string): string {
  return `רחוב ${rnd.pick(STREETS)} ${rnd.int(1, 90)}, ${city}`;
}

function randomPassword(): string {
  const pool = "abcdefghjkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 10; i++) p += pool[randomInt(pool.length)];
  return p;
}

function hash(password: string) {
  return bcrypt.hash(password, ROUNDS);
}

function scoreFor(rnd: Random, ability: number): number {
  const raw = Math.max(45, Math.min(100, ability + rnd.int(-10, 8)));
  const r = rnd.next();
  let score = Math.floor(raw);
  if (r > 0.6 && r <= 0.85) score += 0.5;
  else if (r > 0.85) score += rnd.pick([0.25, 0.75]);
  return Math.min(100, score);
}

/** תאריך לועזי של יום הולדת שנופל היום, לילדה שנולדה בשנה העברית birthYear */
function birthDateWithBirthdayToday(today: string, birthYear: number): string | null {
  const t = new HDate(new Date(`${today}T12:00:00`));
  let month = t.getMonth();
  let day = t.getDate();
  if (month === months.ADAR_II && !HDate.isLeapYear(birthYear)) month = months.ADAR_I;
  const maxDay = HDate.daysInMonth(month, birthYear);
  if (day > maxDay) day = maxDay;
  const g = new HDate(day, month, birthYear).greg();
  const iso = `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, "0")}-${String(g.getDate()).padStart(2, "0")}`;
  return isHebrewBirthday(toDateOnly(iso), toDateOnly(today)) ? iso : null;
}

/** מוחק את כל הנתונים במסד (לפני יצירה מחדש) */
export async function clearDatabase(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE "MessageRecipient", "Message", "Attendance", "AttendanceSession", "Lesson", "Grade", "Exam",
      "GradePeriod", "TeachingAssignment", "User", "Subject", "Class", "School"
    RESTART IDENTITY CASCADE
  `);
}

/**
 * הסיסמה לחשבונות ההדגמה.
 * במחשב: אם לא הוגדרה - "Demo1234!". בענן (production): חובה להגדיר SEED_DEMO_PASSWORD.
 */
export function demoPassword(): string {
  const fromEnv = process.env.SEED_DEMO_PASSWORD?.trim();
  if (fromEnv) {
    if (fromEnv.length < 8) throw new Error("SEED_DEMO_PASSWORD חייבת להכיל לפחות 8 תווים");
    return fromEnv;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "בסביבת production חובה להגדיר SEED_DEMO_PASSWORD (סיסמה לחשבונות ההדגמה). נתוני ההדגמה לא נוצרו.",
    );
  }
  return "Demo1234!";
}

// =====================================================================

export async function runSeed(prisma: PrismaClient): Promise<SeedResult> {
  const basePassword = demoPassword();
  const sisterPassword = `${basePassword}2`;
  const rnd = createRandom(5787);
  usedIdNumbers.clear();
  const today = todayInIsrael();
  const demoAccounts: DemoAccount[] = [];

  await clearDatabase(prisma);

  // ---------------- בית הספר, מקצועות וכיתות ----------------
  const school = await prisma.school.create({ data: MAIN_SCHOOL });

  const subjects = new Map<SubjectName, number>();
  for (const name of SUBJECTS) {
    const s = await prisma.subject.create({ data: { schoolId: school.id, name } });
    subjects.set(name, s.id);
  }

  const classIds = new Map<string, number>();
  const classKey = (g: number, p: number) => `${g}-${p}`;
  for (const c of CLASSES) {
    const created = await prisma.class.create({
      data: { schoolId: school.id, gradeLevel: c.gradeLevel, parallel: c.parallel, schoolYear: SCHOOL_YEAR },
    });
    classIds.set(classKey(c.gradeLevel, c.parallel), created.id);
  }

  // ---------------- מנהלת ומורות ----------------
  const principalEmail = `${PRINCIPAL.emailLocal}@${SCHOOL_DOMAIN}`;
  const principal = await prisma.user.create({
    data: {
      schoolId: school.id,
      role: "PRINCIPAL",
      firstName: PRINCIPAL.firstName,
      lastName: PRINCIPAL.lastName,
      email: principalEmail,
      phone: PRINCIPAL.phone,
      passwordHash: await hash(basePassword),
    },
  });
  demoAccounts.push({
    role: "מנהלת",
    name: `${PRINCIPAL.firstName} ${PRINCIPAL.lastName}`,
    email: principalEmail,
    password: basePassword,
    note: MAIN_SCHOOL.name,
  });

  const teacherIds = new Map<string, number>();
  for (const t of TEACHERS) {
    const email = `${t.emailLocal}@${SCHOOL_DOMAIN}`;
    const password = t.demo ? basePassword : randomPassword();
    const created = await prisma.user.create({
      data: {
        schoolId: school.id,
        role: "TEACHER",
        firstName: t.firstName,
        lastName: t.lastName,
        email,
        phone: t.phone,
        address: address(rnd, MAIN_SCHOOL.city),
        passwordHash: await hash(password),
      },
    });
    teacherIds.set(t.key, created.id);
    if (t.demo) {
      demoAccounts.push({
        role: "מורה",
        name: `${t.firstName} ${t.lastName}`,
        email,
        password,
        note: t.homeroom
          ? `מחנכת ${classDisplayName(t.homeroom.gradeLevel, t.homeroom.parallel)}`
          : `${t.specialist!.subject} בכל הכיתות`,
      });
    }
  }

  // ---------------- תלמידות ----------------
  const classSizes = [23, 22, 24, 23];
  const studentsByClass = new Map<number, number[]>();
  const birthRange: Record<number, [string, string]> = {
    4: ["2016-12-01", "2017-11-30"],
    5: ["2015-12-01", "2016-11-30"],
  };

  interface Family {
    lastName: string;
    email: string;
    phone: string;
    address: string;
    usedFirstNames: Set<string>;
    passwords: Set<string>;
  }
  const families: Family[] = FAMILY_NAMES.map(([lastName, latin]) => ({
    lastName,
    email: `${latin}.family@example.com`,
    phone: phone(rnd),
    address: address(rnd, MAIN_SCHOOL.city),
    usedFirstNames: new Set(),
    passwords: new Set(),
  }));
  let familyIndex = 0;
  const nextFamily = () => families[familyIndex++ % families.length]!;
  // שמונה משפחות עם שתי אחיות: אחת בשכבה ד' ואחת בשכבה ה'
  const sisterFamilies = families.slice(0, 7);
  familyIndex = 7;

  type NewStudent = {
    classId: number;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    birthDate: string;
    password: string;
    demoNote?: string;
  };
  const newStudents: NewStudent[] = [];

  // אחיות ההדגמה (גולדברג)
  for (const sister of [DEMO_SISTERS.younger, DEMO_SISTERS.older]) {
    const isYounger = sister === DEMO_SISTERS.younger;
    newStudents.push({
      classId: classIds.get(classKey(sister.gradeLevel, sister.parallel))!,
      firstName: sister.firstName,
      lastName: DEMO_SISTERS.lastName,
      email: `${DEMO_SISTERS.emailLocal}@example.com`,
      phone: DEMO_SISTERS.phone,
      address: DEMO_SISTERS.address,
      birthDate: sister.birthDate,
      password: isYounger ? basePassword : sisterPassword,
      demoNote: `תלמידה ב${classDisplayName(sister.gradeLevel, sister.parallel)} (אחות ${isYounger ? "צעירה" : "גדולה"}, אותו מייל)`,
    });
  }

  const addStudent = (family: Family, gradeLevel: number, parallel: number) => {
    const classId = classIds.get(classKey(gradeLevel, parallel))!;
    {
      let firstName = rnd.pick(STUDENT_FIRST_NAMES);
      while (family.usedFirstNames.has(firstName)) firstName = rnd.pick(STUDENT_FIRST_NAMES);
      family.usedFirstNames.add(firstName);
      let password = randomPassword();
      while (family.passwords.has(password)) password = randomPassword();
      family.passwords.add(password);
      const [from, to] = birthRange[gradeLevel]!;
      newStudents.push({
        classId,
        firstName,
        lastName: family.lastName,
        email: family.email,
        phone: family.phone,
        address: family.address,
        birthDate: randomDate(rnd, from, to),
        password,
      });
    }
  };

  // משפחות עם שתי אחיות: אחת בשכבה ד' ואחת בשכבה ה', עם אותו מייל של ההורים
  sisterFamilies.forEach((family, k) => {
    addStudent(family, 4, (k % 2) + 1);
    addStudent(family, 5, ((k + 1) % 2) + 1);
  });

  // השלמת כל כיתה למספר התלמידות שלה
  CLASSES.forEach((c, ci) => {
    const classId = classIds.get(classKey(c.gradeLevel, c.parallel))!;
    const already = newStudents.filter((s) => s.classId === classId).length;
    for (let i = already; i < classSizes[ci]!; i++) addStudent(nextFamily(), c.gradeLevel, c.parallel);
  });

  // תלמידה אחת בד'1 שיום ההולדת העברי שלה חל היום - כדי שתהיה ברכה להדגים
  const d1 = classIds.get(classKey(4, 1))!;
  const birthdayGirl = newStudents.find((s) => s.classId === d1 && !s.demoNote);
  if (birthdayGirl) {
    const date = birthDateWithBirthdayToday(today, 5777);
    if (date) birthdayGirl.birthDate = date;
  }

  const hashes = await Promise.all(newStudents.map((s) => hash(s.password)));
  for (let i = 0; i < newStudents.length; i++) {
    const s = newStudents[i]!;
    const created = await prisma.user.create({
      data: {
        schoolId: school.id,
        role: "STUDENT",
        firstName: s.firstName,
        lastName: s.lastName,
        idNumber: idNumber(rnd),
        email: s.email,
        phone: s.phone,
        address: s.address,
        birthDate: toDateOnly(s.birthDate),
        classId: s.classId,
        passwordHash: hashes[i]!,
      },
    });
    const list = studentsByClass.get(s.classId) ?? [];
    list.push(created.id);
    studentsByClass.set(s.classId, list);
    if (s.demoNote) {
      demoAccounts.push({ role: "תלמידה", name: `${s.firstName} ${s.lastName}`, email: s.email, password: s.password, note: s.demoNote });
    }
  }

  // ---------------- שיבוצים ותקופות ----------------
  interface AssignmentInfo {
    id: number;
    classId: number;
    classIndex: number;
    teacherId: number;
    subject: SubjectName;
    periodIds: number[];
  }
  const assignments: AssignmentInfo[] = [];
  const HOMEROOM_SUBJECTS: SubjectName[] = ["חומש", "נביא", "דינים", "לשון"];

  for (const [ci, c] of CLASSES.entries()) {
    const classId = classIds.get(classKey(c.gradeLevel, c.parallel))!;
    for (const subject of SUBJECTS) {
      const teacher = HOMEROOM_SUBJECTS.includes(subject)
        ? TEACHERS.find((t) => t.homeroom?.gradeLevel === c.gradeLevel && t.homeroom.parallel === c.parallel)
        : TEACHERS.find(
            (t) =>
              t.specialist?.subject === subject &&
              t.specialist.classes.some((x) => x.gradeLevel === c.gradeLevel && x.parallel === c.parallel),
          );
      const teacherId = teacherIds.get(teacher!.key)!;
      // ידיעת הארץ: קורס של סמסטר אחד - הדגמה של תקופות בשמות אחרים ומשקל 0
      const periods =
        subject === "ידיעת הארץ"
          ? [
              { name: "סמסטר א'", weight: 100, sortOrder: 1 },
              { name: "סמסטר ב'", weight: 0, sortOrder: 2 },
            ]
          : [
              { name: "מחצית א'", weight: 50, sortOrder: 1 },
              { name: "מחצית ב'", weight: 50, sortOrder: 2 },
            ];
      const created = await prisma.teachingAssignment.create({
        data: { classId, subjectId: subjects.get(subject)!, teacherId, periods: { create: periods } },
        include: { periods: { orderBy: { sortOrder: "asc" } } },
      });
      assignments.push({ id: created.id, classId, classIndex: ci, teacherId, subject, periodIds: created.periods.map((p) => p.id) });
    }
  }

  // ---------------- מערכת שעות ----------------
  // ימים א'-ה': 6 שעות, יום ו': 3 שעות
  const slots: Array<[number, number]> = [];
  for (let day = 1; day <= 6; day++) for (let lesson = 1; lesson <= (day === 6 ? 3 : 6); lesson++) slots.push([day, lesson]);
  const teacherBusy = new Set<string>();
  const classBusy = new Set<string>();
  const lessonsData: Array<{ assignmentId: number; dayOfWeek: number; lessonNumber: number; room: string }> = [];

  // קודם המקצועות של מורות שמלמדות כמה כיתות (הכי מוגבלות)
  const units: AssignmentInfo[] = [];
  const order = [...assignments].sort((a, b) => {
    const spec = (x: AssignmentInfo) => (HOMEROOM_SUBJECTS.includes(x.subject) ? 1 : 0);
    return spec(a) - spec(b) || a.classIndex - b.classIndex;
  });
  for (const a of order) for (let h = 0; h < WEEKLY_HOURS[a.subject]; h++) units.push(a);

  units.forEach((a, unitIndex) => {
    const sameDay = (day: number) =>
      lessonsData.filter((l) => l.assignmentId === a.id && l.dayOfWeek === day).length;
    // מעדיפים לפזר את שעות המקצוע על פני ימים שונים
    const candidates = slots
      .map((slot, i) => ({ slot, rank: sameDay(slot[0]) * 100 + ((i + unitIndex * 5 + a.classIndex * 7) % slots.length) }))
      .sort((x, y) => x.rank - y.rank);
    const found = candidates.find(
      ({ slot: [day, lesson] }) => !classBusy.has(`${a.classId}-${day}-${lesson}`) && !teacherBusy.has(`${a.teacherId}-${day}-${lesson}`),
    );
    if (!found) throw new Error(`לא נמצא מקום במערכת עבור ${a.subject}`);
    const [day, lesson] = found.slot;
    classBusy.add(`${a.classId}-${day}-${lesson}`);
    teacherBusy.add(`${a.teacherId}-${day}-${lesson}`);
    lessonsData.push({
      assignmentId: a.id,
      dayOfWeek: day,
      lessonNumber: lesson,
      room: a.subject === "טבע" ? "מעבדת מדעים" : `חדר ${a.classIndex + 11}`,
    });
  });
  await prisma.lesson.createMany({ data: lessonsData });

  // ---------------- מבחנים וציונים ----------------
  // לכל תלמידה "רמה" כללית, ולכל מקצוע סטייה קטנה ממנה
  const ability = new Map<number, number>();
  for (const ids of studentsByClass.values()) for (const id of ids) ability.set(id, rnd.int(72, 96));

  let examsCount = 0;
  const gradesData: Array<{ examId: number; studentId: number; score: number; evaluation: string | null }> = [];

  for (const a of assignments) {
    const titles = EXAM_TITLES[a.subject];
    const [periodA] = a.periodIds;
    let plan: Array<{ title: string; weight: number; from: string; to: string }>;
    if (a.subject === "דינים") {
      // מחצית א' הושלמה (100%)
      plan = [
        { title: titles[0], weight: 20, from: "2026-09-06", to: "2026-09-17" },
        { title: titles[1], weight: 40, from: "2026-10-06", to: "2026-10-12" },
        { title: titles[2], weight: 40, from: "2026-10-13", to: "2026-10-19" },
      ];
    } else if (a.subject === "ידיעת הארץ") {
      // קורס סמסטריאלי שהסתיים - אפשר לחשב ציון שנתי
      plan = [
        { title: titles[0], weight: 30, from: "2026-09-06", to: "2026-09-17" },
        { title: titles[1], weight: 30, from: "2026-10-05", to: "2026-10-12" },
        { title: titles[2], weight: 40, from: "2026-10-13", to: "2026-10-19" },
      ];
    } else {
      // מחצית בעיצומה: שני מבחנים כבר נערכו, מבחן המחצית בעתיד
      plan = [
        { title: titles[0], weight: 20, from: "2026-09-06", to: "2026-09-17" },
        { title: titles[1], weight: 30, from: "2026-10-06", to: "2026-10-19" },
        { title: titles[2], weight: 50, from: "2027-01-03", to: "2027-01-14" },
      ];
    }
    const periodComplete = plan.reduce((s, p) => s + p.weight, 0) === 100 && plan.every((p) => p.to <= "2026-10-19");
    const subjectShift = rnd.int(-5, 5);

    for (const p of plan) {
      const date = pickExamDay(rnd, p.from, p.to);
      const exam = await prisma.exam.create({
        data: { periodId: periodA!, title: p.title, date: toDateOnly(date), weight: p.weight },
      });
      examsCount++;
      if (date > today) continue; // מבחן עתידי - עוד אין ציונים
      for (const studentId of studentsByClass.get(a.classId)!) {
        // מדי פעם תלמידה חסרה במבחן (רק בתקופה שעוד לא הושלמה)
        if (!periodComplete && rnd.chance(0.03)) continue;
        gradesData.push({
          examId: exam.id,
          studentId,
          score: scoreFor(rnd, ability.get(studentId)! + subjectShift),
          evaluation: rnd.chance(0.15) ? rnd.pick(EVALUATIONS) : null,
        });
      }
    }
  }
  await prisma.grade.createMany({ data: gradesData });

  // ---------------- נוכחות ----------------
  const allDays = schoolDaysBetween(SCHOOL_YEAR_START, today);
  const days = allDays.slice(-MAX_ATTENDANCE_DAYS);
  const sessionsData: Array<{ assignmentId: number; date: Date; lessonNumber: number }> = [];
  const attendanceData: Array<{
    assignmentId: number;
    studentId: number;
    date: Date;
    lessonNumber: number;
    status: AttendanceStatus;
    approved: boolean;
    reason: string | null;
  }> = [];

  for (const day of days) {
    const dow = toDateOnly(day).getUTCDay() + 1;
    const date = toDateOnly(day);
    for (const [classId, studentIds] of studentsByClass) {
      const classAssignments = new Set(assignments.filter((a) => a.classId === classId).map((a) => a.id));
      const todaysLessons = lessonsData
        .filter((l) => l.dayOfWeek === dow && classAssignments.has(l.assignmentId))
        .sort((x, y) => x.lessonNumber - y.lessonNumber);
      for (const l of todaysLessons) sessionsData.push({ assignmentId: l.assignmentId, date, lessonNumber: l.lessonNumber });

      for (const studentId of studentIds) {
        if (rnd.chance(0.035)) {
          // חיסור של יום שלם
          const approved = rnd.chance(0.6);
          const reason = approved ? rnd.pick(ABSENCE_REASONS) : null;
          for (const l of todaysLessons) {
            attendanceData.push({ assignmentId: l.assignmentId, studentId, date, lessonNumber: l.lessonNumber, status: "ABSENT", approved, reason });
          }
          continue;
        }
        let releasedFrom: number | null = null;
        for (const l of todaysLessons) {
          if (releasedFrom === null && l.lessonNumber >= 4 && rnd.chance(0.006)) releasedFrom = l.lessonNumber;
          if (releasedFrom !== null) {
            attendanceData.push({
              assignmentId: l.assignmentId,
              studentId,
              date,
              lessonNumber: l.lessonNumber,
              status: "RELEASED",
              approved: true,
              reason: rnd.pick(RELEASE_REASONS),
            });
          } else if (rnd.chance(l.lessonNumber === 1 ? 0.06 : 0.012)) {
            attendanceData.push({ assignmentId: l.assignmentId, studentId, date, lessonNumber: l.lessonNumber, status: "LATE", approved: false, reason: null });
          }
        }
      }
    }
  }
  await prisma.attendanceSession.createMany({ data: sessionsData });
  await prisma.attendance.createMany({ data: attendanceData });

  // ---------------- הודעות ----------------
  const activeUsers = await prisma.user.findMany({ where: { schoolId: school.id }, select: { id: true, role: true, classId: true } });
  const teachersAll = activeUsers.filter((u) => u.role === "TEACHER").map((u) => u.id);
  const studentsAll = activeUsers.filter((u) => u.role === "STUDENT").map((u) => u.id);
  const h1 = classIds.get(classKey(5, 1))!;
  const messages = [
    {
      title: "הזנת ציוני מחצית א'",
      body: "מורות יקרות, נא להשלים את הזנת כל ציוני מחצית א' במערכת עד ראש חודש שבט. תודה רבה על ההשקעה!",
      audience: "TEACHERS" as const,
      classId: null,
      createdAt: new Date("2026-10-12T08:15:00Z"),
      recipients: teachersAll,
      readRatio: 0.7,
    },
    {
      title: "אסיפת הורים",
      body: "אסיפת הורים לכיתות ד' ו־ה' תתקיים ביום רביעי, כ״ה בחשון, בשעה 19:00 בבניין בית הספר.",
      audience: "ALL" as const,
      classId: null,
      createdAt: new Date("2026-10-18T07:30:00Z"),
      recipients: [...teachersAll, ...studentsAll],
      readRatio: 0.4,
    },
    {
      title: "שבוע הספר",
      body: "בשבוע הבא נקיים את שבוע הספר. כל תלמידה מוזמנת להביא ספר אהוב ולספר עליו לכיתה.",
      audience: "STUDENTS" as const,
      classId: null,
      createdAt: new Date("2026-10-19T06:45:00Z"),
      recipients: studentsAll,
      readRatio: 0.2,
    },
    {
      title: "טיול שנתי",
      body: "תזכורת: ביום חמישי יתקיים הטיול השנתי של כיתה ה'1. יש להגיע בשעה 8:00 עם נעליים נוחות, כובע ובקבוק מים.",
      audience: "CLASS" as const,
      classId: h1,
      createdAt: new Date("2026-10-20T06:00:00Z"),
      recipients: studentsByClass.get(h1)!,
      readRatio: 0.1,
    },
  ];
  for (const m of messages) {
    await prisma.message.create({
      data: {
        schoolId: school.id,
        senderId: principal.id,
        title: m.title,
        body: m.body,
        audience: m.audience,
        classId: m.classId,
        createdAt: m.createdAt,
        recipients: {
          create: m.recipients.map((userId) => ({
            userId,
            readAt: rnd.chance(m.readRatio) ? new Date(m.createdAt.getTime() + rnd.int(1, 48) * 3600000) : null,
          })),
        },
      },
    });
  }

  // ---------------- בית ספר שני (קטן) - להדגמת ההפרדה בין בתי ספר ----------------
  const second = await seedSecondSchool(prisma, rnd, basePassword, today);
  demoAccounts.push(second.principalAccount);

  return {
    demoAccounts,
    counts: {
      schools: 2,
      classes: CLASSES.length + 1,
      teachers: TEACHERS.length + 2,
      students: newStudents.length + second.studentsCount,
      assignments: assignments.length + 2,
      lessons: lessonsData.length,
      exams: examsCount + second.examsCount,
      grades: gradesData.length + second.gradesCount,
      attendanceSessions: sessionsData.length,
      attendanceRecords: attendanceData.length,
      messages: messages.length,
    },
  };
}

async function seedSecondSchool(prisma: PrismaClient, rnd: Random, basePassword: string, today: string) {
  const school = await prisma.school.create({ data: SECOND_SCHOOL });
  const domain = "beit-chana-demo.example";
  const principalEmail = `menahelet@${domain}`;
  await prisma.user.create({
    data: {
      schoolId: school.id,
      role: "PRINCIPAL",
      firstName: "צפורה",
      lastName: "ברקוביץ",
      email: principalEmail,
      phone: "02-6512398",
      passwordHash: await hash(basePassword),
    },
  });
  const cls = await prisma.class.create({ data: { schoolId: school.id, gradeLevel: 5, parallel: 1, schoolYear: SCHOOL_YEAR } });
  const math = await prisma.subject.create({ data: { schoolId: school.id, name: "חשבון" } });
  const hebrew = await prisma.subject.create({ data: { schoolId: school.id, name: "לשון" } });

  const t1 = await prisma.user.create({
    data: { schoolId: school.id, role: "TEACHER", firstName: "נחמה", lastName: "ויינר", email: `nechama.weiner@${domain}`, phone: "054-8312754", passwordHash: await hash(randomPassword()) },
  });
  const t2 = await prisma.user.create({
    data: { schoolId: school.id, role: "TEACHER", firstName: "פנינה", lastName: "שולמן", email: `pnina.shulman@${domain}`, phone: "052-7165439", passwordHash: await hash(randomPassword()) },
  });

  const names: Array<[string, string, string]> = [
    ["אסתר", "ריינר", "reiner"],
    ["מלכה", "גליק", "glick"],
    ["שרה", "פרנקל", "frankel"],
    ["דבורה", "שטיין", "stein"],
    ["חנה", "וייס", "veiss"],
    ["רבקה", "מושקוביץ", "moskovitz"],
  ];
  const studentIds: number[] = [];
  for (const [first, last, latin] of names) {
    const s = await prisma.user.create({
      data: {
        schoolId: school.id,
        role: "STUDENT",
        firstName: first,
        lastName: last,
        idNumber: idNumber(rnd),
        email: `${latin}.family@example.org`,
        phone: phone(rnd),
        address: address(rnd, SECOND_SCHOOL.city),
        birthDate: toDateOnly(randomDate(rnd, "2015-12-01", "2016-11-30")),
        classId: cls.id,
        passwordHash: await hash(randomPassword()),
      },
    });
    studentIds.push(s.id);
  }

  let examsCount = 0;
  let gradesCount = 0;
  for (const [subjectId, teacherId, title] of [
    [math.id, t1.id, "מבחן שברים"],
    [hebrew.id, t2.id, "הבנת הנקרא"],
  ] as const) {
    const a = await prisma.teachingAssignment.create({
      data: {
        classId: cls.id,
        subjectId,
        teacherId,
        periods: { create: [{ name: "מחצית א'", weight: 50, sortOrder: 1 }, { name: "מחצית ב'", weight: 50, sortOrder: 2 }] },
      },
      include: { periods: { orderBy: { sortOrder: "asc" } } },
    });
    const date = "2026-10-14";
    const exam = await prisma.exam.create({ data: { periodId: a.periods[0]!.id, title, date: toDateOnly(date), weight: 30 } });
    examsCount++;
    if (date <= today) {
      await prisma.grade.createMany({
        data: studentIds.map((studentId) => ({ examId: exam.id, studentId, score: scoreFor(rnd, rnd.int(75, 95)) })),
      });
      gradesCount += studentIds.length;
    }
  }

  return {
    studentsCount: studentIds.length,
    examsCount,
    gradesCount,
    principalAccount: {
      role: "מנהלת",
      name: "צפורה ברקוביץ",
      email: principalEmail,
      password: basePassword,
      note: `${SECOND_SCHOOL.name} - לבדיקה שמנהלת לא רואה בית ספר אחר`,
    },
  };
}

/** מדפיס טבלת חשבונות הדגמה וכמויות */
export function printSeedResult(result: SeedResult) {
  /* eslint-disable no-console */
  console.log("\nנתוני ההדגמה נוצרו בהצלחה:");
  console.table(result.counts);
  console.log("\nחשבונות להדגמה:");
  // בענן לא מדפיסים סיסמאות ליומן השרת - הן ידועות רק למי שהגדירה את SEED_DEMO_PASSWORD
  const hide = process.env.NODE_ENV === "production";
  const base = process.env.SEED_DEMO_PASSWORD?.trim() ?? "";
  const shown = (password: string) => (!hide ? password : password === base ? "SEED_DEMO_PASSWORD" : "SEED_DEMO_PASSWORD + 2");
  console.table(
    result.demoAccounts.map((a) => ({ תפקיד: a.role, שם: a.name, מייל: a.email, סיסמה: shown(a.password), הערה: a.note })),
  );
  console.log("לשאר המשתמשות נוצרו סיסמאות אקראיות. המנהלת יכולה לאפס סיסמה לכל אחת.\n");
  /* eslint-enable no-console */
}
