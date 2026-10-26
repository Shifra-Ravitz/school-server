import { numberToHebrewLetters } from "./dates.js";

/**
 * שם כיתה לתצוגה מתוך שכבה ומספר: (4, 2) → "ד'2", (11, 1) → "יא'1".
 * השם לא נשמר במסד הנתונים - הוא תמיד מחושב, כך שאין טעויות הקלדה.
 */
export function classDisplayName(gradeLevel: number, parallel: number): string {
  return `${numberToHebrewLetters(gradeLevel)}'${parallel}`;
}

/**
 * הופך שם כיתה שהוקלד (למשל בקובץ אקסל) לשכבה ומספר.
 * מקבל "ד'1", "ד׳1", "ד1", "ד 1", "ד-1", "יא'2", "י״א2".
 */
export function parseClassName(input: string): { gradeLevel: number; parallel: number } | null {
  const cleaned = input.replace(/['׳"״`\s\-]/g, "");
  const match = /^([א-ת]{1,2})(\d{1,2})$/.exec(cleaned);
  if (!match) return null;
  const [, letters, digits] = match;
  for (let level = 1; level <= 12; level++) {
    if (numberToHebrewLetters(level) === letters) {
      const parallel = Number(digits);
      if (parallel < 1 || parallel > 10) return null;
      return { gradeLevel: level, parallel };
    }
  }
  return null;
}
