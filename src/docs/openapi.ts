/**
 * תיעוד ה־API בתקן OpenAPI 3.
 * מוצג ב־Swagger UI בכתובת /api-docs, וזמין כ־JSON בכתובת /api-docs.json.
 * קובץ docs/openapi.json נוצר מכאן בפקודה: npm run openapi
 */

type Json = Record<string, unknown>;
type Role = "PRINCIPAL" | "TEACHER" | "STUDENT";

const ROLE_NAMES: Record<Role, string> = { PRINCIPAL: "מנהלת", TEACHER: "מורה", STUDENT: "תלמידה" };

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const arrayOf = (schema: Json) => ({ type: "array", items: schema });
const json = (schema: Json, example?: unknown) => ({
  "application/json": { schema, ...(example !== undefined ? { example } : {}) },
});

const errorResponse = (description: string, code: string, message: string) => ({
  description,
  content: json(ref("Error"), { error: { code, message } }),
});

const ERR = {
  400: errorResponse("נתונים לא תקינים", "VALIDATION_ERROR", "הנתונים שנשלחו אינם תקינים"),
  401: errorResponse("לא מחוברת / Token חסר, שגוי או שפג תוקפו", "UNAUTHORIZED", "יש להתחבר למערכת (חסר Token)"),
  403: errorResponse("אין הרשאה לפעולה", "FORBIDDEN", "אין לך הרשאה לפעולה זו"),
  404: errorResponse("הרשומה לא נמצאה (או שייכת לבית ספר אחר)", "NOT_FOUND", "הרשומה לא נמצאה"),
  409: errorResponse("התנגשות: כפילות או מחיקה שאינה אפשרית", "CONFLICT", "רשומה כזו כבר קיימת"),
  422: errorResponse("חריגה מכלל עסקי (למשל משקלים מעל 100%)", "WEIGHT_EXCEEDED", "סכום משקלי המבחנים בתקופה יהיה 110%, המקסימום הוא 100%"),
};

const idPath = (description = "מזהה") => ({
  name: "id",
  in: "path",
  required: true,
  description,
  schema: { type: "integer", minimum: 1 },
});

const q = (name: string, schema: Json, description: string, required = false) => ({
  name,
  in: "query",
  required,
  description,
  schema,
});

const DATE = { type: "string", format: "date", example: "2026-10-20" };
const ORDER = { type: "string", enum: ["asc", "desc"], default: "asc" };

interface OpOptions {
  tag: string;
  summary: string;
  description?: string;
  roles?: Role[] | "all" | "public";
  params?: Json[];
  body?: { schema: Json; example?: unknown; required?: boolean };
  multipart?: Json;
  ok: { status?: number; description: string; schema?: Json; example?: unknown; content?: Json };
  errors?: Array<400 | 403 | 404 | 409 | 422>;
}

function op(o: OpOptions): Json {
  const roles = o.roles ?? "all";
  const isPublic = roles === "public";
  const roleText = isPublic
    ? "פתוח לכולם, ללא Token."
    : roles === "all"
      ? "כל משתמשת מחוברת."
      : roles.map((r) => ROLE_NAMES[r]).join(", ") + ".";
  const responses: Json = {
    [String(o.ok.status ?? 200)]: {
      description: o.ok.description,
      ...(o.ok.content ? { content: o.ok.content } : o.ok.schema ? { content: json(o.ok.schema, o.ok.example) } : {}),
    },
  };
  if (!isPublic) responses["401"] = ERR[401];
  for (const e of o.errors ?? []) responses[String(e)] = ERR[e];
  if (!isPublic && roles !== "all" && !responses["403"]) responses["403"] = ERR[403];

  return {
    tags: [o.tag],
    summary: o.summary,
    description: `${o.description ? `${o.description}\n\n` : ""}**הרשאות:** ${roleText}`,
    ...(isPublic ? { security: [] } : {}),
    ...(o.params ? { parameters: o.params } : {}),
    ...(o.body
      ? { requestBody: { required: o.body.required ?? true, content: json(o.body.schema, o.body.example) } }
      : {}),
    ...(o.multipart
      ? { requestBody: { required: true, content: { "multipart/form-data": { schema: o.multipart } } } }
      : {}),
    responses,
  };
}

const csvContent = { "text/csv": { schema: { type: "string", format: "binary" } } };
const xlsxContent = {
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { schema: { type: "string", format: "binary" } },
};

// ======================= סכמות =======================

const schemas: Json = {
  Error: {
    type: "object",
    properties: {
      error: {
        type: "object",
        required: ["code", "message"],
        properties: {
          code: { type: "string", example: "VALIDATION_ERROR" },
          message: { type: "string", example: "הנתונים שנשלחו אינם תקינים" },
          details: {
            description: "פרטים נוספים, למשל רשימת השדות הבעייתיים",
            example: [{ field: "title", message: "לפחות 2 תווים" }],
          },
        },
      },
    },
  },
  Health: {
    type: "object",
    properties: {
      status: { type: "string", example: "ok" },
      database: { type: "string", example: "ok" },
      time: { type: "string", format: "date-time" },
    },
  },
  Person: {
    type: "object",
    properties: {
      id: { type: "integer", example: 31 },
      firstName: { type: "string", example: "רבקה" },
      lastName: { type: "string", example: "כהן" },
    },
  },
  ClassSummary: {
    type: "object",
    properties: {
      id: { type: "integer", example: 1 },
      name: { type: "string", example: "ד'1", description: "מחושב משכבה ומספר" },
      gradeLevel: { type: "integer", example: 4 },
      parallel: { type: "integer", example: 1 },
      schoolYear: { type: "string", example: "תשפ״ז" },
    },
  },
  Class: {
    allOf: [ref("ClassSummary"), { type: "object", properties: { studentsCount: { type: "integer", example: 23 } } }],
  },
  ClassDetails: {
    allOf: [
      ref("Class"),
      {
        type: "object",
        properties: {
          assignments: arrayOf({
            type: "object",
            properties: {
              id: { type: "integer" },
              subject: ref("Subject"),
              teacher: ref("Person"),
              isMine: { type: "boolean", description: "האם המשתמשת המחוברת מלמדת שיבוץ זה" },
            },
          }),
        },
      },
    ],
  },
  Subject: {
    type: "object",
    properties: { id: { type: "integer", example: 3 }, name: { type: "string", example: "חשבון" } },
  },
  User: {
    type: "object",
    properties: {
      id: { type: "integer", example: 31 },
      role: { type: "string", enum: ["PRINCIPAL", "TEACHER", "STUDENT"] },
      firstName: { type: "string", example: "רבקה" },
      lastName: { type: "string", example: "כהן" },
      email: { type: "string", example: "cohen.family@example.com" },
      idNumber: { type: "string", nullable: true, example: "123456782", description: "תעודת זהות, 9 ספרות" },
      phone: { type: "string", nullable: true, example: "050-1234567" },
      address: { type: "string", nullable: true, example: "רחוב הדוגמה 5, בני ברק" },
      birthDate: { type: "string", format: "date", nullable: true, example: "2017-03-15" },
      hebrewBirthDate: { type: "string", nullable: true, example: "י״ז אדר תשע״ז" },
      classId: { type: "integer", nullable: true, example: 1 },
      class: { ...ref("ClassSummary"), nullable: true },
      isActive: { type: "boolean", example: true },
      createdAt: { type: "string", format: "date-time" },
    },
  },
  UserWithSchool: {
    allOf: [
      ref("User"),
      {
        type: "object",
        properties: {
          school: {
            type: "object",
            properties: { id: { type: "integer" }, name: { type: "string" }, city: { type: "string", nullable: true } },
          },
        },
      },
    ],
  },
  UsersPage: {
    type: "object",
    properties: {
      items: arrayOf(ref("User")),
      total: { type: "integer", example: 93 },
      page: { type: "integer", example: 1 },
      pageSize: { type: "integer", example: 20 },
    },
  },
  CreateUser: {
    type: "object",
    required: ["role", "firstName", "lastName", "email"],
    properties: {
      role: { type: "string", enum: ["TEACHER", "STUDENT"] },
      firstName: { type: "string", minLength: 2, maxLength: 40 },
      lastName: { type: "string", minLength: 2, maxLength: 40 },
      email: { type: "string", format: "email" },
      password: { type: "string", minLength: 6, description: "רשות. אם לא נשלחה - נוצרת סיסמה אקראית ומוחזרת פעם אחת" },
      idNumber: { type: "string", nullable: true, description: "תעודת זהות עם ספרת ביקורת תקינה. חובה לתלמידה. ייחודית בבית הספר" },
      phone: { type: "string", nullable: true },
      address: { type: "string", nullable: true, maxLength: 200 },
      birthDate: { ...DATE, nullable: true, description: "חובה לתלמידה" },
      classId: { type: "integer", nullable: true, description: "חובה לתלמידה, אסור למורה" },
    },
  },
  UpdateUser: {
    type: "object",
    properties: {
      firstName: { type: "string" },
      lastName: { type: "string" },
      email: { type: "string", format: "email" },
      idNumber: { type: "string", nullable: true },
      phone: { type: "string", nullable: true },
      address: { type: "string", nullable: true },
      birthDate: { ...DATE, nullable: true },
      classId: { type: "integer", nullable: true, description: "העברת תלמידה לכיתה אחרת" },
      isActive: { type: "boolean", description: "false = השבתה (במקום מחיקה)" },
    },
  },
  Assignment: {
    type: "object",
    properties: {
      id: { type: "integer", example: 7 },
      class: ref("ClassSummary"),
      subject: ref("Subject"),
      teacher: ref("Person"),
      studentsCount: { type: "integer", example: 23 },
    },
  },
  PeriodStatus: {
    type: "object",
    properties: {
      id: { type: "integer", example: 13 },
      name: { type: "string", example: "מחצית א'" },
      weight: { type: "integer", example: 50 },
      sortOrder: { type: "integer", example: 1 },
      examsCount: { type: "integer", example: 3 },
      examsWeight: { type: "integer", example: 70, description: "סכום משקלי המבחנים בתקופה" },
      isComplete: { type: "boolean", example: false, description: "true כשמשקלי המבחנים = 100%" },
    },
  },
  PeriodsOverview: {
    type: "object",
    properties: {
      items: arrayOf(ref("PeriodStatus")),
      totalWeight: { type: "integer", example: 100 },
      canCalculateAnnual: { type: "boolean" },
      problems: arrayOf({ type: "string", example: "במחצית א' הוגדרו רק 70% מהמבחנים" }),
    },
  },
  Exam: {
    type: "object",
    properties: {
      id: { type: "integer", example: 41 },
      title: { type: "string", example: "מבחן שברים" },
      date: DATE,
      weight: { type: "integer", example: 30 },
      description: { type: "string", nullable: true },
      period: { type: "object", properties: { id: { type: "integer" }, name: { type: "string", example: "מחצית א'" } } },
      assignmentId: { type: "integer", example: 7 },
      gradesCount: { type: "integer", example: 22 },
      average: { type: "number", nullable: true, example: 86.4 },
    },
  },
  ExamInput: {
    type: "object",
    required: ["title", "date", "weight"],
    properties: {
      title: { type: "string", minLength: 2, maxLength: 80, example: "מבחן שברים" },
      date: DATE,
      weight: { type: "integer", minimum: 1, maximum: 100, example: 30 },
      description: { type: "string", nullable: true, maxLength: 500, example: "פרקים 1-3" },
    },
  },
  ExamGrades: {
    type: "object",
    properties: {
      exam: ref("Exam"),
      items: arrayOf({
        type: "object",
        properties: {
          student: ref("Person"),
          score: { type: "number", nullable: true, example: 92.5 },
          evaluation: { type: "string", nullable: true, example: "עבודה יפה ומסודרת" },
        },
      }),
    },
  },
  FinalGrades: {
    type: "object",
    properties: {
      assignment: {
        type: "object",
        properties: { id: { type: "integer" }, class: ref("ClassSummary"), subject: ref("Subject"), teacher: ref("Person") },
      },
      periods: arrayOf({
        allOf: [
          ref("PeriodStatus"),
          {
            type: "object",
            properties: {
              exams: arrayOf({
                type: "object",
                properties: { id: { type: "integer" }, title: { type: "string" }, date: DATE, weight: { type: "integer" } },
              }),
            },
          },
        ],
      }),
      periodsWeight: { type: "integer", example: 100 },
      canCalculateAnnual: { type: "boolean", example: false },
      problems: arrayOf({ type: "string" }),
      students: arrayOf({
        type: "object",
        properties: {
          studentId: { type: "integer" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          scores: { type: "object", additionalProperties: { type: "number", nullable: true }, description: "מזהה מבחן ← ציון" },
          evaluations: { type: "object", additionalProperties: { type: "string", nullable: true }, description: "מזהה מבחן ← הערכה מילולית" },
          periodGrades: {
            type: "object",
            additionalProperties: { type: "number", nullable: true },
            description: "מזהה תקופה ← ציון (null אם התקופה לא הושלמה)",
          },
          annualGrade: { type: "number", nullable: true },
        },
      }),
    },
  },
  AttendanceRecord: {
    type: "object",
    properties: {
      id: { type: "integer", example: 120 },
      assignmentId: { type: "integer", example: 7 },
      date: DATE,
      lessonNumber: { type: "integer", example: 3 },
      status: { type: "string", enum: ["LATE", "ABSENT", "RELEASED"] },
      symbol: { type: "string", enum: ["+", "-", "ש"], description: "+ איחור, - חיסור, ש שחרור" },
      label: { type: "string", example: "איחור" },
      approved: { type: "boolean", example: false },
      reason: { type: "string", nullable: true, example: "אישור רפואי" },
      student: ref("Person"),
    },
  },
  LessonRoster: {
    type: "object",
    properties: {
      date: DATE,
      lessonNumber: { type: "integer", example: 3 },
      taken: { type: "boolean", description: "האם כבר נשמרה נוכחות לשיעור" },
      items: arrayOf({
        type: "object",
        properties: {
          student: ref("Person"),
          attendanceId: { type: "integer", nullable: true },
          status: { type: "string", nullable: true, enum: ["LATE", "ABSENT", "RELEASED", null] },
          symbol: { type: "string", description: "ריק = נוכחת", example: "" },
          approved: { type: "boolean" },
          reason: { type: "string", nullable: true },
        },
      }),
    },
  },
  SaveLessonAttendance: {
    type: "object",
    required: ["date", "lessonNumber", "records"],
    properties: {
      date: DATE,
      lessonNumber: { type: "integer", minimum: 1, maximum: 10, example: 3 },
      records: arrayOf({
        type: "object",
        required: ["studentId", "status"],
        properties: {
          studentId: { type: "integer" },
          status: { type: "string", enum: ["LATE", "ABSENT", "RELEASED"] },
          approved: { type: "boolean", description: "לא נשלח = נשאר הערך הקיים (בחדש: false)" },
          reason: { type: "string", nullable: true, maxLength: 200 },
        },
      }),
    },
  },
  AttendanceCounts: {
    type: "object",
    properties: {
      lessons: { type: "integer", example: 42, description: "שיעורים שבהם נבדקה נוכחות" },
      late: { type: "integer", example: 2 },
      absent: { type: "integer", example: 1 },
      released: { type: "integer", example: 0 },
      approved: { type: "integer", example: 1 },
      attendancePercent: { type: "number", nullable: true, example: 97.6 },
    },
  },
  Lesson: {
    type: "object",
    properties: {
      id: { type: "integer", example: 55 },
      dayOfWeek: { type: "integer", example: 2, description: "1 = ראשון ... 6 = שישי" },
      dayName: { type: "string", example: "שני" },
      lessonNumber: { type: "integer", example: 3 },
      room: { type: "string", nullable: true, example: "חדר 12" },
      assignmentId: { type: "integer", example: 7 },
      subject: ref("Subject"),
      class: ref("ClassSummary"),
      teacher: ref("Person"),
    },
  },
  LessonInput: {
    type: "object",
    required: ["assignmentId", "dayOfWeek", "lessonNumber"],
    properties: {
      assignmentId: { type: "integer", example: 7 },
      dayOfWeek: { type: "integer", minimum: 1, maximum: 6, example: 2 },
      lessonNumber: { type: "integer", minimum: 1, maximum: 10, example: 3 },
      room: { type: "string", nullable: true, maxLength: 30, example: "חדר 12" },
    },
  },
  MyGrades: {
    type: "object",
    properties: {
      subjects: arrayOf({
        type: "object",
        properties: {
          assignmentId: { type: "integer" },
          subject: ref("Subject"),
          teacher: ref("Person"),
          annualGrade: { type: "number", nullable: true },
          canCalculateAnnual: { type: "boolean" },
          problems: arrayOf({ type: "string" }),
          periods: arrayOf({
            type: "object",
            properties: {
              id: { type: "integer" },
              name: { type: "string" },
              weight: { type: "integer" },
              examsWeight: { type: "integer" },
              isComplete: { type: "boolean" },
              grade: { type: "number", nullable: true },
              exams: arrayOf({
                type: "object",
                properties: {
                  id: { type: "integer" },
                  title: { type: "string" },
                  date: DATE,
                  weight: { type: "integer" },
                  score: { type: "number", nullable: true },
                  evaluation: { type: "string", nullable: true },
                },
              }),
            },
          }),
        },
      }),
    },
  },
  MyAttendance: {
    type: "object",
    properties: {
      items: arrayOf({
        type: "object",
        properties: {
          id: { type: "integer" },
          date: DATE,
          lessonNumber: { type: "integer" },
          status: { type: "string", enum: ["LATE", "ABSENT", "RELEASED"] },
          symbol: { type: "string" },
          label: { type: "string" },
          approved: { type: "boolean" },
          reason: { type: "string", nullable: true },
          subject: ref("Subject"),
        },
      }),
      summary: {
        allOf: [
          ref("AttendanceCounts"),
          {
            type: "object",
            properties: {
              bySubject: arrayOf({ allOf: [{ type: "object", properties: { subject: ref("Subject") } }, ref("AttendanceCounts")] }),
            },
          },
        ],
      },
    },
  },
  Message: {
    type: "object",
    properties: {
      id: { type: "integer", example: 4 },
      title: { type: "string", example: "הגשת ציוני מחצית" },
      body: { type: "string", example: "יש להזין את ציוני מחצית א' עד ראש חודש שבט." },
      audience: { type: "string", enum: ["ALL", "TEACHERS", "STUDENTS", "CLASS"] },
      audienceLabel: { type: "string", example: "כל המורות" },
      class: { ...ref("ClassSummary"), nullable: true },
      sender: ref("Person"),
      createdAt: { type: "string", format: "date-time" },
      isRead: { type: "boolean" },
      readAt: { type: "string", format: "date-time", nullable: true },
    },
  },
  Birthdays: {
    type: "object",
    properties: {
      date: DATE,
      hebrewDate: { type: "string", example: "ט׳ חשון תשפ״ז" },
      isMyBirthday: { type: "boolean", description: "לתלמידה: האם היום יום ההולדת שלה" },
      items: arrayOf({
        type: "object",
        properties: {
          studentId: { type: "integer" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          className: { type: "string", nullable: true, example: "ד'1" },
          age: { type: "integer", example: 10 },
          hebrewBirthDate: { type: "string", example: "ט׳ חשון תשע״ז" },
          greeting: { type: "string", example: "מזל טוב לרבקה כהן מכיתה ד'1 ליום הולדתה!" },
        },
      }),
    },
  },
};

// ======================= נתיבים =======================

const paths: Json = {
  "/api/health": {
    get: op({
      tag: "כללי",
      summary: "בדיקת בריאות השרת ומסד הנתונים",
      roles: "public",
      ok: { description: "השרת פועל", schema: ref("Health"), example: { status: "ok", database: "ok", time: "2026-10-20T10:00:00.000Z" } },
    }),
  },

  // ---------------- התחברות ----------------
  "/api/auth/login": {
    post: op({
      tag: "התחברות",
      summary: "התחברות במייל וסיסמה",
      description:
        "מחזירה JWT. את ה־token מעתיקים לכפתור **Authorize** למעלה. אחיות יכולות לחלוק מייל - הסיסמה קובעת מי נכנסה.",
      roles: "public",
      body: {
        schema: {
          type: "object",
          required: ["email", "password"],
          properties: { email: { type: "string", format: "email" }, password: { type: "string" } },
        },
        example: { email: "menahelet@bais-yaakov-demo.example", password: "Demo1234!" },
      },
      ok: {
        description: "התחברות הצליחה",
        schema: {
          type: "object",
          properties: { token: { type: "string" }, expiresIn: { type: "string", example: "8h" }, user: ref("UserWithSchool") },
        },
      },
      errors: [400],
    }),
  },
  "/api/auth/me": {
    get: op({
      tag: "התחברות",
      summary: "פרטי המשתמשת המחוברת",
      ok: { description: "פרטי המשתמשת", schema: { type: "object", properties: { user: ref("UserWithSchool") } } },
    }),
  },
  "/api/auth/me/password": {
    patch: op({
      tag: "התחברות",
      summary: "שינוי סיסמה של המשתמשת המחוברת",
      body: {
        schema: {
          type: "object",
          required: ["currentPassword", "newPassword"],
          properties: { currentPassword: { type: "string" }, newPassword: { type: "string", minLength: 6 } },
        },
      },
      ok: { status: 204, description: "הסיסמה שונתה" },
      errors: [400, 409],
    }),
  },

  // ---------------- משתמשות ----------------
  "/api/users": {
    get: op({
      tag: "משתמשות",
      summary: "רשימת משתמשות עם חיפוש, סינון, מיון ועימוד",
      roles: ["PRINCIPAL"],
      params: [
        q("role", { type: "string", enum: ["PRINCIPAL", "TEACHER", "STUDENT"] }, "סינון לפי תפקיד"),
        q("classId", { type: "integer" }, "סינון תלמידות לפי כיתה"),
        q("firstName", { type: "string" }, "חיפוש לפי שם פרטי (גם חלק מהשם)"),
        q("lastName", { type: "string" }, "חיפוש לפי שם משפחה (גם חלק מהשם)"),
        q("search", { type: "string" }, "חיפוש חופשי בשם פרטי, שם משפחה, מייל ותעודת זהות"),
        q("isActive", { type: "string", enum: ["true", "false", "all"], default: "true" }, "פעילות / מושבתות / כולן"),
        q("sortBy", { type: "string", enum: ["firstName", "lastName", "createdAt"], default: "lastName" }, "מיון לפי"),
        q("order", ORDER, "כיוון המיון"),
        q("page", { type: "integer", default: 1 }, "מספר עמוד"),
        q("pageSize", { type: "integer", default: 20, maximum: 100 }, "גודל עמוד"),
      ],
      ok: { description: "רשימה", schema: ref("UsersPage") },
      errors: [400],
    }),
    post: op({
      tag: "משתמשות",
      summary: "יצירת מורה או תלמידה",
      roles: ["PRINCIPAL"],
      body: {
        schema: ref("CreateUser"),
        example: {
          role: "STUDENT",
          firstName: "שרה",
          lastName: "לוי",
          idNumber: "123456782",
          email: "levi.family@example.com",
          phone: "050-1112233",
          address: "רחוב הדוגמה 3",
          birthDate: "2017-01-05",
          classId: 1,
        },
      },
      ok: {
        status: 201,
        description: "נוצרה. generatedPassword מוחזרת רק כשהשרת יצר סיסמה",
        schema: { type: "object", properties: { user: ref("User"), generatedPassword: { type: "string", nullable: true } } },
      },
      errors: [400, 409],
    }),
  },
  "/api/users/{id}": {
    get: op({ tag: "משתמשות", summary: "משתמשת אחת", roles: ["PRINCIPAL"], params: [idPath()], ok: { description: "פרטים", schema: ref("User") }, errors: [404] }),
    patch: op({
      tag: "משתמשות",
      summary: "עריכה, העברת כיתה או השבתה",
      roles: ["PRINCIPAL"],
      params: [idPath()],
      body: { schema: ref("UpdateUser"), example: { classId: 2 } },
      ok: { description: "עודכנה", schema: ref("User") },
      errors: [400, 404],
    }),
  },
  "/api/users/{id}/reset-password": {
    post: op({
      tag: "משתמשות",
      summary: "איפוס סיסמה",
      description: "אם לא נשלחה סיסמה - נוצרת סיסמה אקראית. הסיסמה מוחזרת פעם אחת בלבד.",
      roles: ["PRINCIPAL"],
      params: [idPath()],
      body: { schema: { type: "object", properties: { password: { type: "string", minLength: 6 } } }, required: false, example: {} },
      ok: { description: "הסיסמה החדשה", schema: { type: "object", properties: { temporaryPassword: { type: "string", example: "kd7mx4pa" } } } },
      errors: [400, 404, 409],
    }),
  },
  "/api/users/import/template.xlsx": {
    get: op({
      tag: "משתמשות",
      summary: "הורדת קובץ אקסל לדוגמה לייבוא תלמידות",
      roles: ["PRINCIPAL"],
      ok: { description: "קובץ xlsx", content: xlsxContent },
    }),
  },
  "/api/users/import": {
    post: op({
      tag: "משתמשות",
      summary: "ייבוא תלמידות מקובץ אקסל",
      description:
        "כל השורות נבדקות קודם. אם יש שגיאה - לא נשמר דבר ומוחזר 400 עם details: [{ row, field, message }]. לכל תלמידה נוצרת סיסמה אקראית.",
      roles: ["PRINCIPAL"],
      multipart: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary" } } },
      ok: {
        status: 201,
        description: "התלמידות נוספו",
        schema: {
          type: "object",
          properties: {
            created: { type: "integer", example: 24 },
            importId: { type: "string", format: "uuid" },
            students: arrayOf({
              type: "object",
              properties: {
                id: { type: "integer" },
                firstName: { type: "string" },
                lastName: { type: "string" },
                className: { type: "string" },
                email: { type: "string" },
                password: { type: "string" },
              },
            }),
          },
        },
      },
      errors: [400],
    }),
  },
  "/api/users/import/{importId}/passwords.xlsx": {
    get: op({
      tag: "משתמשות",
      summary: "קובץ אקסל עם הסיסמאות של ייבוא (הורדה אחת, עד 30 דקות)",
      roles: ["PRINCIPAL"],
      params: [{ name: "importId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      ok: { description: "קובץ xlsx", content: xlsxContent },
      errors: [404],
    }),
  },

  // ---------------- כיתות ----------------
  "/api/classes": {
    get: op({
      tag: "כיתות",
      summary: "רשימת כיתות (מורה: רק הכיתות שלה)",
      roles: ["PRINCIPAL", "TEACHER"],
      params: [q("gradeLevel", { type: "integer" }, "סינון לפי שכבה (4 = ד')"), q("schoolYear", { type: "string" }, "סינון לפי שנה")],
      ok: { description: "רשימה", schema: arrayOf(ref("Class")) },
    }),
    post: op({
      tag: "כיתות",
      summary: "יצירת כיתה",
      roles: ["PRINCIPAL"],
      body: {
        schema: {
          type: "object",
          required: ["gradeLevel", "parallel"],
          properties: {
            gradeLevel: { type: "integer", minimum: 1, maximum: 12 },
            parallel: { type: "integer", minimum: 1, maximum: 10 },
            schoolYear: { type: "string", description: "רשות. ברירת מחדל: השנה הנוכחית" },
          },
        },
        example: { gradeLevel: 6, parallel: 1 },
      },
      ok: { status: 201, description: "נוצרה", schema: ref("Class") },
      errors: [400, 409],
    }),
  },
  "/api/classes/{id}": {
    get: op({ tag: "כיתות", summary: "כיתה עם השיבוצים שלה", roles: ["PRINCIPAL", "TEACHER"], params: [idPath()], ok: { description: "פרטים", schema: ref("ClassDetails") }, errors: [404] }),
    patch: op({
      tag: "כיתות",
      summary: "עריכת כיתה",
      roles: ["PRINCIPAL"],
      params: [idPath()],
      body: { schema: { type: "object", properties: { gradeLevel: { type: "integer" }, parallel: { type: "integer" }, schoolYear: { type: "string" } } } },
      ok: { description: "עודכנה", schema: ref("Class") },
      errors: [400, 404, 409],
    }),
    delete: op({ tag: "כיתות", summary: "מחיקת כיתה ריקה", roles: ["PRINCIPAL"], params: [idPath()], ok: { status: 204, description: "נמחקה" }, errors: [404, 409] }),
  },
  "/api/classes/{id}/students": {
    get: op({
      tag: "כיתות",
      summary: "תלמידות הכיתה עם חיפוש ומיון",
      roles: ["PRINCIPAL", "TEACHER"],
      params: [
        idPath("מזהה הכיתה"),
        q("firstName", { type: "string" }, "שם פרטי"),
        q("lastName", { type: "string" }, "שם משפחה"),
        q("search", { type: "string" }, "חיפוש חופשי"),
        q("sortBy", { type: "string", enum: ["firstName", "lastName", "address"], default: "lastName" }, "מיון"),
        q("order", ORDER, "כיוון"),
      ],
      ok: { description: "רשימה", schema: arrayOf(ref("User")) },
      errors: [404],
    }),
  },
  "/api/classes/{id}/schedule": {
    get: op({ tag: "מערכת שעות", summary: "מערכת השעות של כיתה", roles: ["PRINCIPAL", "TEACHER"], params: [idPath("מזהה הכיתה")], ok: { description: "שיעורים", schema: arrayOf(ref("Lesson")) }, errors: [404] }),
  },

  // ---------------- מקצועות ----------------
  "/api/subjects": {
    get: op({ tag: "מקצועות", summary: "רשימת מקצועות", ok: { description: "רשימה", schema: arrayOf(ref("Subject")) } }),
    post: op({
      tag: "מקצועות",
      summary: "הוספת מקצוע",
      roles: ["PRINCIPAL"],
      body: { schema: { type: "object", required: ["name"], properties: { name: { type: "string" } } }, example: { name: "מדעים" } },
      ok: { status: 201, description: "נוסף", schema: ref("Subject") },
      errors: [400, 409],
    }),
  },
  "/api/subjects/{id}": {
    patch: op({
      tag: "מקצועות",
      summary: "שינוי שם מקצוע",
      roles: ["PRINCIPAL"],
      params: [idPath()],
      body: { schema: { type: "object", required: ["name"], properties: { name: { type: "string" } } } },
      ok: { description: "עודכן", schema: ref("Subject") },
      errors: [400, 404, 409],
    }),
    delete: op({ tag: "מקצועות", summary: "מחיקת מקצוע שאין לו שיבוצים", roles: ["PRINCIPAL"], params: [idPath()], ok: { status: 204, description: "נמחק" }, errors: [404, 409] }),
  },

  // ---------------- שיבוצים ----------------
  "/api/assignments": {
    get: op({
      tag: "שיבוצים",
      summary: "שיבוצים: מורה + כיתה + מקצוע (מורה: רק שלה)",
      roles: ["PRINCIPAL", "TEACHER"],
      params: [q("classId", { type: "integer" }, "סינון לפי כיתה"), q("teacherId", { type: "integer" }, "סינון לפי מורה (מנהלת)"), q("subjectId", { type: "integer" }, "סינון לפי מקצוע")],
      ok: { description: "רשימה", schema: arrayOf(ref("Assignment")) },
    }),
    post: op({
      tag: "שיבוצים",
      summary: "שיבוץ מורה למקצוע בכיתה (נוצרות אוטומטית מחצית א' ומחצית ב')",
      roles: ["PRINCIPAL"],
      body: {
        schema: { type: "object", required: ["classId", "subjectId", "teacherId"], properties: { classId: { type: "integer" }, subjectId: { type: "integer" }, teacherId: { type: "integer" } } },
        example: { classId: 1, subjectId: 3, teacherId: 5 },
      },
      ok: { status: 201, description: "נוצר", schema: ref("Assignment") },
      errors: [400, 409],
    }),
  },
  "/api/assignments/{id}": {
    get: op({ tag: "שיבוצים", summary: "שיבוץ אחד", roles: ["PRINCIPAL", "TEACHER"], params: [idPath()], ok: { description: "פרטים", schema: ref("Assignment") }, errors: [404] }),
    patch: op({
      tag: "שיבוצים",
      summary: "החלפת מורה בשיבוץ",
      roles: ["PRINCIPAL"],
      params: [idPath()],
      body: { schema: { type: "object", required: ["teacherId"], properties: { teacherId: { type: "integer" } } } },
      ok: { description: "עודכן", schema: ref("Assignment") },
      errors: [400, 404, 409],
    }),
    delete: op({ tag: "שיבוצים", summary: "מחיקת שיבוץ שאין בו ציונים ונוכחות", roles: ["PRINCIPAL"], params: [idPath()], ok: { status: 204, description: "נמחק" }, errors: [404, 409] }),
  },

  // ---------------- תקופות ----------------
  "/api/assignments/{id}/periods": {
    get: op({ tag: "תקופות ציון", summary: "תקופות הציון של שיבוץ", roles: ["PRINCIPAL", "TEACHER"], params: [idPath("מזהה השיבוץ")], ok: { description: "תקופות ומצב המשקלים", schema: ref("PeriodsOverview") }, errors: [404] }),
    post: op({
      tag: "תקופות ציון",
      summary: "הוספת תקופה (למשל סמסטר ג')",
      roles: ["PRINCIPAL", "TEACHER"],
      params: [idPath("מזהה השיבוץ")],
      body: {
        schema: { type: "object", required: ["name", "weight"], properties: { name: { type: "string" }, weight: { type: "integer", minimum: 0, maximum: 100 }, sortOrder: { type: "integer" } } },
        example: { name: "סמסטר ג'", weight: 0 },
      },
      ok: { status: 201, description: "כל התקופות אחרי ההוספה", schema: ref("PeriodsOverview") },
      errors: [400, 404, 409, 422],
    }),
  },
  "/api/periods/{id}": {
    patch: op({
      tag: "תקופות ציון",
      summary: "שינוי שם, משקל או סדר של תקופה",
      roles: ["PRINCIPAL", "TEACHER"],
      params: [idPath()],
      body: { schema: { type: "object", properties: { name: { type: "string" }, weight: { type: "integer" }, sortOrder: { type: "integer" } } }, example: { name: "סמסטר א'", weight: 40 } },
      ok: { description: "כל התקופות אחרי העדכון", schema: ref("PeriodsOverview") },
      errors: [400, 404, 409, 422],
    }),
    delete: op({ tag: "תקופות ציון", summary: "מחיקת תקופה בלי מבחנים", roles: ["PRINCIPAL", "TEACHER"], params: [idPath()], ok: { status: 204, description: "נמחקה" }, errors: [404, 409] }),
  },

  // ---------------- מבחנים ----------------
  "/api/assignments/{id}/exams": {
    get: op({
      tag: "מבחנים",
      summary: "מבחני השיבוץ עם סינון ומיון",
      roles: ["PRINCIPAL", "TEACHER"],
      params: [
        idPath("מזהה השיבוץ"),
        q("periodId", { type: "integer" }, "סינון לפי תקופה"),
        q("from", DATE, "מתאריך"),
        q("to", DATE, "עד תאריך"),
        q("search", { type: "string" }, "חיפוש בכותרת"),
        q("sortBy", { type: "string", enum: ["date", "title", "weight"], default: "date" }, "מיון"),
        q("order", ORDER, "כיוון"),
      ],
      ok: { description: "רשימה", schema: arrayOf(ref("Exam")) },
      errors: [400, 404],
    }),
  },
  "/api/periods/{id}/exams": {
    post: op({
      tag: "מבחנים",
      summary: "הוספת מבחן לתקופה",
      description: "סכום משקלי המבחנים בתקופה לא יכול לעבור 100% (אחרת 422 WEIGHT_EXCEEDED).",
      roles: ["PRINCIPAL", "TEACHER"],
      params: [idPath("מזהה התקופה")],
      body: { schema: ref("ExamInput"), example: { title: "מבחן שברים", date: "2026-10-15", weight: 30, description: "פרקים 1-3" } },
      ok: { status: 201, description: "נוסף", schema: ref("Exam") },
      errors: [400, 404, 422],
    }),
  },
  "/api/exams/{id}": {
    get: op({ tag: "מבחנים", summary: "מבחן אחד", roles: ["PRINCIPAL", "TEACHER"], params: [idPath()], ok: { description: "פרטים", schema: ref("Exam") }, errors: [404] }),
    patch: op({
      tag: "מבחנים",
      summary: "עריכת מבחן (כולל העברה לתקופה אחרת)",
      roles: ["PRINCIPAL", "TEACHER"],
      params: [idPath()],
      body: {
        schema: { type: "object", properties: { title: { type: "string" }, date: DATE, weight: { type: "integer" }, description: { type: "string", nullable: true }, periodId: { type: "integer" } } },
        example: { weight: 25 },
      },
      ok: { description: "עודכן", schema: ref("Exam") },
      errors: [400, 404, 422],
    }),
    delete: op({ tag: "מבחנים", summary: "מחיקת מבחן (וכל הציונים שלו)", roles: ["PRINCIPAL", "TEACHER"], params: [idPath()], ok: { status: 204, description: "נמחק" }, errors: [404] }),
  },

  // ---------------- ציונים ----------------
  "/api/exams/{id}/grades": {
    get: op({
      tag: "ציונים",
      summary: "כל תלמידות הכיתה עם הציון וההערכה במבחן",
      roles: ["PRINCIPAL", "TEACHER"],
      params: [idPath("מזהה המבחן")],
      ok: { description: "רשימה", schema: ref("ExamGrades") },
      errors: [404],
    }),
    put: op({
      tag: "ציונים",
      summary: "שמירת ציונים בבת אחת",
      description:
        "ציון 0-100 עם עד שתי ספרות אחרי הנקודה. score: null מוחק ציון. evaluation שלא נשלחה - ההערכה הקיימת נשמרת.",
      roles: ["PRINCIPAL", "TEACHER"],
      params: [idPath("מזהה המבחן")],
      body: {
        schema: {
          type: "object",
          required: ["grades"],
          properties: {
            grades: arrayOf({
              type: "object",
              required: ["studentId", "score"],
              properties: {
                studentId: { type: "integer" },
                score: { type: "number", nullable: true, minimum: 0, maximum: 100 },
                evaluation: { type: "string", nullable: true, maxLength: 500 },
              },
            }),
          },
        },
        example: { grades: [{ studentId: 31, score: 98.5, evaluation: "כל הכבוד!" }, { studentId: 32, score: 87 }] },
      },
      ok: { description: "הרשימה המעודכנת", schema: ref("ExamGrades") },
      errors: [400, 404],
    }),
  },
  "/api/assignments/{id}/final-grades": {
    get: op({
      tag: "ציונים",
      summary: "ציוני תקופות וציון שנתי לכל תלמידה",
      description:
        "ציון תקופה מחושב רק כשמשקלי המבחנים בה = 100%. ציון שנתי - רק כשמשקלי התקופות = 100% וכל תקופה עם משקל הושלמה. ציון חסר = 0. מה שחסר מופיע ב־problems.",
      roles: ["PRINCIPAL", "TEACHER"],
      params: [
        idPath("מזהה השיבוץ"),
        q("sortBy", { type: "string", enum: ["lastName", "firstName", "annual"], default: "lastName" }, "מיון"),
        q("order", ORDER, "כיוון"),
      ],
      ok: {
        description: "ציונים מחושבים",
        schema: ref("FinalGrades"),
        example: {
          periods: [
            { id: 1, name: "מחצית א'", weight: 50, examsWeight: 100, isComplete: true },
            { id: 2, name: "מחצית ב'", weight: 50, examsWeight: 70, isComplete: false },
          ],
          periodsWeight: 100,
          canCalculateAnnual: false,
          problems: ["במחצית ב' הוגדרו רק 70% מהמבחנים"],
          students: [{ studentId: 31, firstName: "רבקה", lastName: "כהן", scores: { "41": 80 }, periodGrades: { "1": 77, "2": null }, annualGrade: null }],
        },
      },
      errors: [400, 404],
    }),
  },

  "/api/assignments/{id}/grades": {
    put: op({
      tag: "ציונים",
      summary: "שמירת טבלת ציונים שלמה (כמה מבחנים וכמה תלמידות) בבקשה אחת",
      description:
        "שולחים רק את התאים שהשתנו. score: null מוחק ציון. evaluation שלא נשלחה - ההערכה הקיימת נשמרת. מחזיר את הטבלה המעודכנת, בדיוק כמו final-grades.",
      roles: ["PRINCIPAL", "TEACHER"],
      params: [idPath("מזהה השיבוץ")],
      body: {
        schema: {
          type: "object",
          required: ["grades"],
          properties: {
            grades: arrayOf({
              type: "object",
              required: ["examId", "studentId", "score"],
              properties: {
                examId: { type: "integer" },
                studentId: { type: "integer" },
                score: { type: "number", nullable: true, minimum: 0, maximum: 100 },
                evaluation: { type: "string", nullable: true, maxLength: 500 },
              },
            }),
          },
        },
        example: {
          grades: [
            { examId: 1, studentId: 21, score: 95 },
            { examId: 2, studentId: 21, score: 88.5, evaluation: "יפה מאוד" },
            { examId: 1, studentId: 32, score: null },
          ],
        },
      },
      ok: { description: "הטבלה המעודכנת", schema: ref("FinalGrades") },
      errors: [400, 404],
    }),
  },

  // ---------------- נוכחות ----------------
  "/api/assignments/{id}/attendance": {
    get: op({
      tag: "נוכחות",
      summary: "רשומות נוכחות (חריגות) של שיבוץ עם סינון",
      roles: ["PRINCIPAL", "TEACHER"],
      params: [
        idPath("מזהה השיבוץ"),
        q("date", DATE, "תאריך מסוים"),
        q("lessonNumber", { type: "integer" }, "שעה"),
        q("from", DATE, "מתאריך"),
        q("to", DATE, "עד תאריך"),
        q("status", { type: "string", enum: ["LATE", "ABSENT", "RELEASED"] }, "סטטוס"),
        q("approved", { type: "string", enum: ["true", "false"] }, "מאושרות / לא מאושרות"),
        q("studentId", { type: "integer" }, "תלמידה מסוימת"),
        q("firstName", { type: "string" }, "שם פרטי"),
        q("lastName", { type: "string" }, "שם משפחה"),
        q("search", { type: "string" }, "חיפוש חופשי"),
        q("order", { ...ORDER, default: "desc" }, "כיוון לפי תאריך"),
      ],
      ok: { description: "רשימה", schema: arrayOf(ref("AttendanceRecord")) },
      errors: [400, 404],
    }),
    put: op({
      tag: "נוכחות",
      summary: "שמירת נוכחות לשיעור אחד",
      description: "שולחים רק חריגות (+ איחור, - חיסור, ש שחרור). תלמידה שלא נשלחה נחשבת נוכחת. אי אפשר תאריך עתידי.",
      roles: ["PRINCIPAL", "TEACHER"],
      params: [idPath("מזהה השיבוץ")],
      body: {
        schema: ref("SaveLessonAttendance"),
        example: { date: "2026-10-19", lessonNumber: 3, records: [{ studentId: 31, status: "LATE" }, { studentId: 35, status: "ABSENT", approved: true, reason: "אישור רפואי" }] },
      },
      ok: { description: "כל תלמידות הכיתה בשיעור", schema: ref("LessonRoster") },
      errors: [400, 404],
    }),
  },
  "/api/assignments/{id}/attendance/lesson": {
    get: op({
      tag: "נוכחות",
      summary: "כל תלמידות הכיתה בשיעור מסוים עם הסימון שלהן (למסך סימון נוכחות)",
      roles: ["PRINCIPAL", "TEACHER"],
      params: [idPath("מזהה השיבוץ"), q("date", DATE, "תאריך", true), q("lessonNumber", { type: "integer" }, "שעה", true)],
      ok: { description: "רשימה", schema: ref("LessonRoster") },
      errors: [400, 404],
    }),
  },
  "/api/attendance/{id}": {
    patch: op({
      tag: "נוכחות",
      summary: "תיקון רשומה: סטטוס, אישור או סיבה",
      roles: ["PRINCIPAL", "TEACHER"],
      params: [idPath()],
      body: {
        schema: { type: "object", properties: { status: { type: "string", enum: ["LATE", "ABSENT", "RELEASED"] }, approved: { type: "boolean" }, reason: { type: "string", nullable: true } } },
        example: { approved: true, reason: "אישור רפואי" },
      },
      ok: { description: "עודכנה", schema: ref("AttendanceRecord") },
      errors: [400, 404],
    }),
    delete: op({ tag: "נוכחות", summary: "מחיקת רשומה (התלמידה תיחשב נוכחת)", roles: ["PRINCIPAL", "TEACHER"], params: [idPath()], ok: { status: 204, description: "נמחקה" }, errors: [404] }),
  },

  // ---------------- מערכת שעות ----------------
  "/api/schedule/me": {
    get: op({
      tag: "מערכת שעות",
      summary: "המערכת שלי: מורה - השיעורים שלה, תלמידה - המערכת של הכיתה",
      ok: { description: "שיעורים ממוינים לפי יום ושעה", schema: arrayOf(ref("Lesson")) },
    }),
  },
  "/api/schedule/teachers/{id}": {
    get: op({ tag: "מערכת שעות", summary: "המערכת של מורה", roles: ["PRINCIPAL"], params: [idPath("מזהה המורה")], ok: { description: "שיעורים", schema: arrayOf(ref("Lesson")) }, errors: [404] }),
  },
  "/api/lessons": {
    post: op({
      tag: "מערכת שעות",
      summary: "הוספת שיעור למערכת",
      description: "אין שני שיעורים לאותה כיתה או לאותה מורה באותו יום ושעה (409).",
      roles: ["PRINCIPAL", "TEACHER"],
      body: { schema: ref("LessonInput"), example: { assignmentId: 7, dayOfWeek: 2, lessonNumber: 3, room: "חדר 12" } },
      ok: { status: 201, description: "נוסף", schema: ref("Lesson") },
      errors: [400, 404, 409],
    }),
  },
  "/api/lessons/{id}": {
    patch: op({
      tag: "מערכת שעות",
      summary: "שינוי שיעור",
      roles: ["PRINCIPAL", "TEACHER"],
      params: [idPath()],
      body: { schema: { type: "object", properties: { assignmentId: { type: "integer" }, dayOfWeek: { type: "integer" }, lessonNumber: { type: "integer" }, room: { type: "string", nullable: true } } }, example: { lessonNumber: 4 } },
      ok: { description: "עודכן", schema: ref("Lesson") },
      errors: [400, 404, 409],
    }),
    delete: op({ tag: "מערכת שעות", summary: "מחיקת שיעור", roles: ["PRINCIPAL", "TEACHER"], params: [idPath()], ok: { status: 204, description: "נמחק" }, errors: [404] }),
  },

  // ---------------- אזור התלמידה ----------------
  "/api/me/grades": {
    get: op({
      tag: "אזור התלמידה",
      summary: "הציונים שלי, לפי מקצוע",
      roles: ["STUDENT"],
      params: [q("subjectId", { type: "integer" }, "מקצוע"), q("periodId", { type: "integer" }, "תקופה")],
      ok: { description: "ציונים", schema: ref("MyGrades") },
      errors: [400],
    }),
  },
  "/api/me/attendance": {
    get: op({
      tag: "אזור התלמידה",
      summary: "הנוכחות שלי עם סיכום",
      roles: ["STUDENT"],
      params: [
        q("status", { type: "string", enum: ["LATE", "ABSENT", "RELEASED"] }, "סטטוס"),
        q("approved", { type: "string", enum: ["true", "false"] }, "מאושרות"),
        q("subjectId", { type: "integer" }, "מקצוע"),
        q("from", DATE, "מתאריך"),
        q("to", DATE, "עד תאריך"),
      ],
      ok: { description: "חריגות וסיכום", schema: ref("MyAttendance") },
      errors: [400],
    }),
  },

  // ---------------- הודעות ----------------
  "/api/messages": {
    get: op({
      tag: "הודעות",
      summary: "תיבת ההודעות שלי",
      params: [q("unread", { type: "string", enum: ["true", "false"] }, "true = רק שלא נקראו")],
      ok: { description: "הודעות", schema: { type: "object", properties: { unreadCount: { type: "integer" }, items: arrayOf(ref("Message")) } } },
    }),
    post: op({
      tag: "הודעות",
      summary: "שליחת הודעה",
      roles: ["PRINCIPAL"],
      body: {
        schema: {
          type: "object",
          required: ["title", "body", "audience"],
          properties: {
            title: { type: "string", maxLength: 100 },
            body: { type: "string", maxLength: 2000 },
            audience: { type: "string", enum: ["ALL", "TEACHERS", "STUDENTS", "CLASS"] },
            classId: { type: "integer", description: "חובה כש־audience = CLASS" },
          },
        },
        example: { title: "הגשת ציונים", body: "יש להזין את ציוני מחצית א' עד יום חמישי.", audience: "TEACHERS" },
      },
      ok: { status: 201, description: "נשלחה", schema: { allOf: [ref("Message"), { type: "object", properties: { recipientsCount: { type: "integer" } } }] } },
      errors: [400],
    }),
  },
  "/api/messages/sent": {
    get: op({ tag: "הודעות", summary: "הודעות ששלחתי, עם כמה קראו", roles: ["PRINCIPAL"], ok: { description: "הודעות", schema: arrayOf(ref("Message")) } }),
  },
  "/api/messages/read-all": {
    patch: op({ tag: "הודעות", summary: "סימון כל ההודעות כנקראו", ok: { description: "כמה עודכנו", schema: { type: "object", properties: { updated: { type: "integer" } } } } }),
  },
  "/api/messages/{id}/read": {
    patch: op({ tag: "הודעות", summary: "סימון הודעה כנקראה", params: [idPath()], ok: { status: 204, description: "סומנה" }, errors: [404] }),
  },
  "/api/messages/{id}": {
    delete: op({ tag: "הודעות", summary: "מחיקת הודעה מהתיבה שלי בלבד", params: [idPath()], ok: { status: 204, description: "נמחקה" }, errors: [404] }),
  },

  // ---------------- ימי הולדת ----------------
  "/api/birthdays/today": {
    get: op({
      tag: "ימי הולדת",
      summary: "ברכות יום הולדת להיום (לפי התאריך העברי)",
      description: "מנהלת: כל התלמידות. מורה: התלמידות שהיא מלמדת. תלמידה: רק היא. אפשר לשלוח ?date= כדי לבדוק תאריך אחר.",
      params: [q("date", DATE, "רשות: תאריך לבדיקה")],
      ok: { description: "חוגגות היום", schema: ref("Birthdays") },
      errors: [400],
    }),
  },

  // ---------------- ייצוא ----------------
  "/api/exports/students.csv": {
    get: op({
      tag: "ייצוא",
      summary: "רשימת תלמידות כקובץ CSV לאקסל",
      roles: ["PRINCIPAL", "TEACHER"],
      params: [q("classId", { type: "integer" }, "כיתה (בלי = כל בית הספר / כל הכיתות של המורה)")],
      ok: { description: "קובץ CSV", content: csvContent },
      errors: [400, 404],
    }),
  },
  "/api/exports/teachers.csv": {
    get: op({ tag: "ייצוא", summary: "רשימת מורות כקובץ CSV", roles: ["PRINCIPAL"], ok: { description: "קובץ CSV", content: csvContent } }),
  },
  "/api/exports/grades.csv": {
    get: op({
      tag: "ייצוא",
      summary: "ציונים של שיבוץ: שם, כיתה, ציון כל מבחן, ציוני תקופות וציון שנתי",
      roles: ["PRINCIPAL", "TEACHER"],
      params: [q("assignmentId", { type: "integer" }, "מזהה השיבוץ", true)],
      ok: { description: "קובץ CSV", content: csvContent },
      errors: [400, 404],
    }),
  },
};

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "מערכת ניהול בית ספר - API",
    version: "1.0.0",
    description: [
      "שרת למערכת ניהול בית ספר: כיתות, מבחנים, ציונים, נוכחות, מערכת שעות והודעות.",
      "",
      "**איך בודקים כאן:**",
      "1. פותחים את `POST /api/auth/login`, לוחצים **Try it out**, מכניסים מייל וסיסמה ולוחצים **Execute**.",
      "2. מעתיקים את הערך של `token` מהתשובה.",
      "3. לוחצים על הכפתור **Authorize** למעלה, מדביקים את ה־token ולוחצים Authorize.",
      "4. עכשיו אפשר לנסות כל נתיב מוגן.",
      "",
      "תפקידים: PRINCIPAL = מנהלת, TEACHER = מורה, STUDENT = תלמידה.",
      "כל השגיאות מוחזרות במבנה `{ \"error\": { \"code\", \"message\", \"details\" } }`.",
    ].join("\n"),
  },
  servers: [{ url: "/", description: "השרת הנוכחי" }],
  tags: [
    "כללי",
    "התחברות",
    "משתמשות",
    "כיתות",
    "מקצועות",
    "שיבוצים",
    "תקופות ציון",
    "מבחנים",
    "ציונים",
    "נוכחות",
    "מערכת שעות",
    "אזור התלמידה",
    "הודעות",
    "ימי הולדת",
    "ייצוא",
  ].map((name) => ({ name })),
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "ה־token מהתשובה של login" },
    },
    schemas,
  },
  security: [{ bearerAuth: [] }],
  paths,
};
