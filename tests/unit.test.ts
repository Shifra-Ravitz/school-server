import { describe, expect, it } from "vitest";
import { assignmentStatus, studentGrades } from "../src/utils/gradeCalculator.js";
import { classDisplayName, parseClassName } from "../src/utils/classNames.js";
import {
  currentSchoolYear,
  hebrewDateString,
  isHebrewBirthday,
  numberToHebrewLetters,
  toDateOnly,
  withGeresh,
} from "../src/utils/dates.js";
import { computeCounts } from "../src/modules/attendance/attendance.service.js";
import { toCsv } from "../src/utils/files.js";

describe("חישוב ציונים", () => {
  const periods = [
    { id: 1, name: "מחצית א'", weight: 50, sortOrder: 1, exams: [{ id: 11, weight: 30 }, { id: 12, weight: 20 }, { id: 13, weight: 50 }] },
    { id: 2, name: "מחצית ב'", weight: 50, sortOrder: 2, exams: [{ id: 21, weight: 100 }] },
  ];

  it("מחשב ציון תקופה וציון שנתי כשהכול מגיע ל־100%", () => {
    const scores = new Map([[11, 80], [12, 90], [13, 70], [21, 85]]);
    const result = studentGrades(periods, scores);
    expect(result.periodGrades["1"]).toBe(77);
    expect(result.periodGrades["2"]).toBe(85);
    expect(result.annualGrade).toBe(81);
  });

  it("ציון חסר נחשב 0", () => {
    const scores = new Map([[11, 80], [12, 90], [21, 85]]);
    expect(studentGrades(periods, scores).periodGrades["1"]).toBe(42);
  });

  it("תומך בציונים עשרוניים ומעגל לספרה אחת", () => {
    const scores = new Map([[11, 98.5], [12, 99.25], [13, 87.75], [21, 90]]);
    const result = studentGrades(periods, scores);
    expect(result.periodGrades["1"]).toBe(93.3); // 29.55 + 19.85 + 43.875 = 93.275
  });

  it("לא מחשב תקופה שהמשקלים בה לא מגיעים ל־100%", () => {
    const partial = [{ ...periods[0]!, exams: [{ id: 11, weight: 30 }, { id: 12, weight: 40 }] }, periods[1]!];
    const status = assignmentStatus(partial);
    expect(status.periods[0]!.isComplete).toBe(false);
    expect(status.canCalculateAnnual).toBe(false);
    expect(status.problems).toContain("במחצית א' הוגדרו רק 70% מהמבחנים");
    const result = studentGrades(partial, new Map([[11, 100], [12, 100], [21, 100]]));
    expect(result.periodGrades["1"]).toBeNull();
    expect(result.annualGrade).toBeNull();
  });

  it("תקופה במשקל 0% לא נכנסת לציון השנתי (קורס של מחצית אחת)", () => {
    const oneSemester = [
      { id: 1, name: "סמסטר א'", weight: 100, sortOrder: 1, exams: [{ id: 11, weight: 40 }, { id: 12, weight: 60 }] },
      { id: 2, name: "סמסטר ב'", weight: 0, sortOrder: 2, exams: [] },
    ];
    const result = studentGrades(oneSemester, new Map([[11, 80], [12, 90]]));
    expect(result.annualGrade).toBe(86);
  });

  it("מדווח כשמשקלי התקופות לא מסתכמים ב־100%", () => {
    const status = assignmentStatus([{ ...periods[0]!, weight: 60 }, periods[1]!]);
    expect(status.problems[0]).toContain("110%");
  });
});

describe("שמות כיתות", () => {
  it("יוצר שם משכבה ומספר", () => {
    expect(classDisplayName(4, 2)).toBe("ד'2");
    expect(classDisplayName(11, 1)).toBe("יא'1");
  });
  it("מפענח צורות כתיבה שונות", () => {
    expect(parseClassName("ד'1")).toEqual({ gradeLevel: 4, parallel: 1 });
    expect(parseClassName("ה׳2")).toEqual({ gradeLevel: 5, parallel: 2 });
    expect(parseClassName("ד 2")).toEqual({ gradeLevel: 4, parallel: 2 });
    expect(parseClassName("י״א3")).toEqual({ gradeLevel: 11, parallel: 3 });
    expect(parseClassName("כיתה")).toBeNull();
  });
});

describe("תאריכים עבריים", () => {
  it("ממיר מספרים לאותיות", () => {
    expect(numberToHebrewLetters(15)).toBe("טו");
    expect(withGeresh(numberToHebrewLetters(787))).toBe("תשפ״ז");
    expect(withGeresh("ד")).toBe("ד׳");
  });
  it("מציג תאריך עברי", () => {
    expect(hebrewDateString(toDateOnly("2026-10-20"))).toBe("ט׳ חשון תשפ״ז");
  });
  it("מזהה יום הולדת לפי התאריך העברי", () => {
    // 10.11.2016 = ט' חשון תשע"ז
    expect(isHebrewBirthday(toDateOnly("2016-11-10"), toDateOnly("2026-10-20"))).toBe(true);
    expect(isHebrewBirthday(toDateOnly("2016-11-10"), toDateOnly("2026-11-10"))).toBe(false);
  });
  it("מחשב את שנת הלימודים", () => {
    expect(currentSchoolYear(new Date("2026-10-20T10:00:00Z"))).toBe("תשפ״ז");
    expect(currentSchoolYear(new Date("2027-03-01T10:00:00Z"))).toBe("תשפ״ז");
    expect(currentSchoolYear(new Date("2027-09-01T10:00:00Z"))).toBe("תשפ״ח");
  });
});

describe("ולידציה של תאריכים", () => {
  it("דוחה תאריך לא קיים ופורמט שגוי", async () => {
    const { dateString } = await import("../src/utils/validation.js");
    expect(dateString.safeParse("2026-02-28").success).toBe(true);
    expect(dateString.safeParse("2026-02-30").success).toBe(false);
    expect(dateString.safeParse("28/02/2026").success).toBe(false);
  });
});

describe("סיכום נוכחות", () => {
  it("רק חיסור לא מאושר מוריד מאחוז הנוכחות", () => {
    const counts = computeCounts(20, [
      { status: "ABSENT", approved: false },
      { status: "ABSENT", approved: true },
      { status: "LATE", approved: false },
      { status: "RELEASED", approved: true },
    ]);
    expect(counts).toMatchObject({ lessons: 20, late: 1, absent: 2, released: 1, approved: 2, attendancePercent: 95 });
  });
  it("בלי שיעורים אין אחוז", () => {
    expect(computeCounts(0, []).attendancePercent).toBeNull();
  });
});

describe("CSV", () => {
  it("מוסיף BOM ומטפל בפסיקים ומרכאות", () => {
    const csv = toCsv(["שם", "הערה"], [["רבקה", 'אמרה "שלום", ויצאה']]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"אמרה ""שלום"", ויצאה"');
  });
});
