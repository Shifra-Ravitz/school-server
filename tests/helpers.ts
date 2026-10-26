import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";

export const app = createApp();
export const api = () => request(app);
export { prisma };

/** חשבונות ההדגמה מה־Seed (בבדיקות הסיסמה היא ברירת המחדל) */
export const ACCOUNTS = {
  principal: { email: "menahelet@bais-yaakov-demo.example", password: "Demo1234!" },
  teacherCohen: { email: "miriam.cohen@bais-yaakov-demo.example", password: "Demo1234!" },
  teacherEnglish: { email: "dvora.horowitz@bais-yaakov-demo.example", password: "Demo1234!" },
  studentYounger: { email: "goldberg.family@example.com", password: "Demo1234!" },
  studentOlder: { email: "goldberg.family@example.com", password: "Demo1234!2" },
  otherPrincipal: { email: "menahelet@beit-chana-demo.example", password: "Demo1234!" },
} as const;

export type AccountName = keyof typeof ACCOUNTS;

const tokenCache = new Map<string, string>();

export async function tokenFor(name: AccountName): Promise<string> {
  const cached = tokenCache.get(name);
  if (cached) return cached;
  const res = await api().post("/api/auth/login").send(ACCOUNTS[name]);
  if (res.status !== 200) throw new Error(`login failed for ${name}: ${res.status} ${JSON.stringify(res.body)}`);
  tokenCache.set(name, res.body.token as string);
  return res.body.token as string;
}

export async function auth(name: AccountName) {
  return { Authorization: `Bearer ${await tokenFor(name)}` };
}

/** מזהי ישויות שימושיות מנתוני ההדגמה */
export async function demoIds() {
  const school = await prisma.school.findFirstOrThrow({ where: { name: { contains: "עטרת שרה" } } });
  const otherSchool = await prisma.school.findFirstOrThrow({ where: { name: { contains: "בית חנה" } } });
  const classD1 = await prisma.class.findFirstOrThrow({ where: { schoolId: school.id, gradeLevel: 4, parallel: 1 } });
  const classD2 = await prisma.class.findFirstOrThrow({ where: { schoolId: school.id, gradeLevel: 4, parallel: 2 } });
  const classH1 = await prisma.class.findFirstOrThrow({ where: { schoolId: school.id, gradeLevel: 5, parallel: 1 } });
  const otherClass = await prisma.class.findFirstOrThrow({ where: { schoolId: otherSchool.id } });
  const cohen = await prisma.user.findFirstOrThrow({ where: { email: ACCOUNTS.teacherCohen.email } });
  const english = await prisma.user.findFirstOrThrow({ where: { email: ACCOUNTS.teacherEnglish.email } });
  const younger = await prisma.user.findFirstOrThrow({ where: { email: ACCOUNTS.studentYounger.email, firstName: "חיה" } });
  const older = await prisma.user.findFirstOrThrow({ where: { email: ACCOUNTS.studentOlder.email, firstName: "רחל" } });
  const subject = async (name: string) => prisma.subject.findFirstOrThrow({ where: { schoolId: school.id, name } });
  const assignment = async (classId: number, subjectName: string) =>
    prisma.teachingAssignment.findFirstOrThrow({ where: { classId, subject: { name: subjectName } } });
  return {
    school,
    otherSchool,
    classD1,
    classD2,
    classH1,
    otherClass,
    cohen,
    english,
    younger,
    older,
    subject,
    assignment,
    cohenDinim: await assignment(classD1.id, "דינים"),
    cohenChumash: await assignment(classD1.id, "חומש"),
    levyDinim: await assignment(classD2.id, "דינים"),
    englishD1: await assignment(classD1.id, "אנגלית"),
    otherAssignment: await prisma.teachingAssignment.findFirstOrThrow({ where: { classId: otherClass.id } }),
  };
}
