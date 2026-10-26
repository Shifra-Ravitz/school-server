# מדריך לצד ה־React: איך מתחברים לשרת

המסמך מסביר מה השרת מצפה לקבל ומה הוא מחזיר, כדי שתוכלי לכתוב את ה־React בעצמך. אין כאן קוד React, רק כתובות, מבני נתונים, דוגמאות JSON וכללים.

> את כל הנתיבים אפשר לנסות ב־Swagger (`/api-docs`) לפני שכותבים קוד. מומלץ לנסות כל נתיב שם קודם, ולראות בדיוק מה חוזר.

---

## 1. כתובת השרת (Base URL)

| איפה | כתובת |
| --- | --- |
| במחשב | `http://localhost:3000/api` |
| בענן | `https://<שם-השירות>.onrender.com/api` |

מומלץ לשמור את הכתובת במשתנה סביבה של Vite בשם `VITE_API_URL` (בקובץ `.env` של פרויקט ה־React), ולא לכתוב אותה ישירות בקוד. כך מחליפים בין המחשב לענן בלי לשנות קוד.

כדי שהדפדפן יאפשר לאתר לפנות לשרת, הכתובת של אתר ה־React צריכה להופיע במשתנה `CORS_ORIGINS` של השרת. במחשב: `http://localhost:5173` (ברירת המחדל של Vite).

---

## 2. התחברות (Authentication)

### התהליך
1. במסך הכניסה שולחים `POST /api/auth/login` עם מייל וסיסמה.
2. השרת מחזיר `token` ואת פרטי המשתמשת (`user`), כולל `role`.
3. שומרים את ה־token (למשל ב־localStorage) ואת פרטי המשתמשת (למשל ב־Context), כדי שכל המסכים יידעו מי מחוברת.
4. **בכל בקשה אחרת** שולחים כותרת:
   ```
   Authorization: Bearer <token>
   ```
5. ה־token תקף 8 שעות. אם השרת מחזיר **401**, ה־token חסר, שגוי או שפג תוקפו: מוחקים אותו ומעבירים למסך הכניסה.
6. ביציאה מהמערכת פשוט מוחקים את ה־token בצד ה־React. אין צורך בקריאה לשרת.
7. כשהאתר נטען מחדש ויש token שמור, אפשר לקרוא ל־`GET /api/auth/me` כדי לקבל שוב את פרטי המשתמשת ולוודא שה־token עדיין תקף.

### מה כל תפקיד רואה
לפי `user.role` מחליטים אילו מסכים להציג ולאן להפנות אחרי הכניסה:

| role | תפקיד | מסך בית מומלץ |
| --- | --- | --- |
| `PRINCIPAL` | מנהלת | ניהול: כיתות / תלמידות / מורות |
| `TEACHER` | מורה | הכיתות שלי (רשימת שיבוצים) |
| `STUDENT` | תלמידה | הציונים שלי |

> הסתרת כפתורים ב־React היא רק נוחות. ההגנה האמיתית בשרת: גם אם מישהי תנסה לגשת לכתובת שאסורה לה, השרת יחזיר 403.

### דוגמה
`POST /api/auth/login`
```json
{ "email": "miriam.cohen@bais-yaakov-demo.example", "password": "Demo1234!" }
```
תשובה (200):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": "8h",
  "user": {
    "id": 2,
    "role": "TEACHER",
    "firstName": "מרים",
    "lastName": "כהן",
    "email": "miriam.cohen@bais-yaakov-demo.example",
    "phone": "052-7614382",
    "address": "רחוב אהרונוביץ 69, בני ברק",
    "birthDate": null,
    "hebrewBirthDate": null,
    "classId": null,
    "class": null,
    "isActive": true,
    "createdAt": "2026-10-20T19:06:27.404Z",
    "school": { "id": 1, "name": "בית יעקב 'עטרת שרה'" }
  }
}
```
מייל או סיסמה שגויים: **401** עם `INVALID_CREDENTIALS`.

---

## 3. כללים כלליים

- **פורמט:** כל הבקשות והתשובות ב־JSON (חוץ מקבצים להורדה). בבקשות עם גוף שולחים `Content-Type: application/json`.
- **תאריכים:** מחרוזת `YYYY-MM-DD`, למשל `"2026-10-20"`. זה בדיוק הפורמט של `<input type="date">`.
- **מזהים:** מספרים (`id`).
- **שם כיתה:** השרת מחזיר תמיד `class.name` מוכן לתצוגה, למשל `"ד'1"`. אין צורך לחשב אותו.
- **ציונים:** מספרים בין 0 ל־100, עם עד שתי ספרות אחרי הנקודה (`98.5`, `99.25`). ציון שעוד לא הוזן הוא `null`.
- **ריק = null:** שדה רשות ריק מוחזר כ־`null`. כששולחים מחרוזת ריקה בשדה רשות, השרת שומר `null`.

### מבנה שגיאה (תמיד אותו מבנה)
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "הנתונים שנשלחו אינם תקינים",
    "details": [
      { "field": "title", "message": "לפחות 2 תווים" },
      { "field": "weight", "message": "משקל בין 1 ל־100" }
    ]
  }
}
```
את `message` אפשר להציג למשתמשת כמו שהוא, בעברית. ב־`details` יש את השם של כל שדה שגוי, כך שאפשר להציג את השגיאה ליד השדה בטופס.

### קודי שגיאה

| קוד HTTP | `error.code` | מתי | מה עושים ב־React |
| --- | --- | --- | --- |
| 400 | `VALIDATION_ERROR` | נתונים לא תקינים | מציגים את השגיאות ליד השדות |
| 400 | `WRONG_PASSWORD` | סיסמה נוכחית שגויה בשינוי סיסמה | הודעה בטופס |
| 400 | `IMPORT_VALIDATION_ERROR` | שגיאות בקובץ אקסל | מציגים רשימה: שורה + שדה + הודעה |
| 401 | `UNAUTHORIZED` / `INVALID_TOKEN` / `TOKEN_EXPIRED` | אין Token / לא תקין / פג תוקף | מוחקים Token ועוברים לכניסה |
| 401 | `INVALID_CREDENTIALS` | מייל או סיסמה שגויים | הודעה במסך הכניסה |
| 403 | `FORBIDDEN` | אין הרשאה | הודעה "אין הרשאה" |
| 404 | `NOT_FOUND` | הרשומה לא קיימת | הודעה / חזרה לרשימה |
| 409 | `CONFLICT` | כפילות, או מחיקה שאינה אפשרית | מציגים את `message` |
| 409 | `AMBIGUOUS_LOGIN` | שתי משתמשות עם אותו מייל וסיסמה (נדיר) | "יש לפנות למנהלת" |
| 413 | `FILE_TOO_LARGE` | קובץ מעל 2MB | הודעה |
| 422 | `WEIGHT_EXCEEDED` | משקלים מעל 100% | מציגים את `message`. ב־`details.maxAllowed` יש את המשקל המקסימלי שעוד אפשר |
| 429 | `TOO_MANY_ATTEMPTS` | יותר מדי ניסיונות כניסה | "נסי שוב בעוד 15 דקות" |
| 500 | `INTERNAL_ERROR` | תקלה בשרת | הודעה כללית |

---

## 4. מבני הנתונים

כך נראים האובייקטים שהשרת מחזיר (בכתיב של TypeScript, כדי שתוכלי להגדיר טיפוסים בפרויקט):

```ts
type Role = "PRINCIPAL" | "TEACHER" | "STUDENT";
type AttendanceStatus = "LATE" | "ABSENT" | "RELEASED";

interface Person { id: number; firstName: string; lastName: string }

interface ClassSummary { id: number; name: string; gradeLevel: number; parallel: number; schoolYear: string }
interface ClassItem extends ClassSummary { studentsCount: number }

interface Subject { id: number; name: string }

interface User {
  id: number; role: Role; firstName: string; lastName: string; email: string;
  idNumber: string | null;         // תעודת זהות, 9 ספרות
  phone: string | null; address: string | null;
  birthDate: string | null;        // "2017-03-15"
  hebrewBirthDate: string | null;  // "י״ז אדר תשע״ז"
  classId: number | null; class: ClassSummary | null;
  isActive: boolean; createdAt: string;
}

interface Assignment { id: number; class: ClassSummary; subject: Subject; teacher: Person; studentsCount: number }

interface PeriodStatus {
  id: number; name: string; weight: number; sortOrder: number;
  examsCount: number; examsWeight: number; isComplete: boolean;
}

interface Exam {
  id: number; title: string; date: string; weight: number; description: string | null;
  period: { id: number; name: string }; assignmentId: number;
  gradesCount: number; average: number | null;
}

interface Lesson {
  id: number; dayOfWeek: number; dayName: string; lessonNumber: number; room: string | null;
  assignmentId: number; subject: Subject; class: ClassSummary; teacher: Person;
}

interface AttendanceRecord {
  id: number; assignmentId: number; date: string; lessonNumber: number;
  status: AttendanceStatus; symbol: "+" | "-" | "ש"; label: string;
  approved: boolean; reason: string | null; student: Person;
}
```

### מקרא הנוכחות

| status | סימן (`symbol`) | משמעות |
| --- | --- | --- |
| (אין רשומה) | ריק | נוכחת |
| `LATE` | `+` | איחור |
| `ABSENT` | `-` | חיסור |
| `RELEASED` | `ש` | שחרור |

`approved: true` = מאושר (למשל עם אישור רפואי). אפשר להציג סימן מאושר בצבע אחר או עם עיגול. חיסור מאושר לא נספר באחוז הנוכחות.

---

## 5. אילו נתיבים צריך לכל מסך

### מסכים משותפים

| מסך | נתיבים |
| --- | --- |
| כניסה | `POST /auth/login` |
| טעינת האתר עם Token שמור | `GET /auth/me` |
| הודעות קופצות אחרי כניסה (רשות) | `GET /messages?unread=true`, `GET /birthdays/today`, `PATCH /messages/{id}/read` |
| תיבת הודעות (רשות) | `GET /messages` (או `?unread=true`/`false`), `PATCH /messages/{id}/read`, `PATCH /messages/read-all`, `DELETE /messages/{id}` |
| שינוי סיסמה (רשות) | `PATCH /auth/me/password` |

### מורה

| מסך | נתיבים |
| --- | --- |
| הכיתות שלי | `GET /assignments` (כל כרטיס = מקצוע + כיתה) |
| תלמידות הכיתה | `GET /classes/{classId}/students?firstName=&lastName=&search=&sortBy=&order=` |
| תקופות ציון | `GET /assignments/{id}/periods`, `POST /assignments/{id}/periods`, `PATCH /periods/{id}`, `DELETE /periods/{id}` |
| רשימת מבחנים | `GET /assignments/{id}/exams?periodId=&from=&to=&search=&sortBy=&order=` |
| טופס מבחן (הוספה / עריכה) | הוספה: `POST /periods/{periodId}/exams`. עריכה: `GET /exams/{id}` + `PATCH /exams/{id}`. מחיקה: `DELETE /exams/{id}` |
| הזנת ציונים | `GET /exams/{id}/grades`, `PUT /exams/{id}/grades` |
| טבלת ציונים (תלמידות × מבחנים) | קריאה: `GET /assignments/{id}/final-grades?sortBy=&order=`. שמירה: `PUT /assignments/{id}/grades` |
| ייצוא / הדפסה (רשות) | `GET /exports/grades.csv?assignmentId=`, `GET /exports/students.csv?classId=` |
| סימון נוכחות | `GET /assignments/{id}/attendance/lesson?date=&lessonNumber=`, `PUT /assignments/{id}/attendance` |
| היסטוריית נוכחות | `GET /assignments/{id}/attendance?from=&to=&status=&approved=&firstName=&lastName=`, `PATCH /attendance/{id}`, `DELETE /attendance/{id}` |
| המערכת שלי | `GET /schedule/me`, `POST /lessons`, `PATCH /lessons/{id}`, `DELETE /lessons/{id}` |

### תלמידה

| מסך | נתיבים |
| --- | --- |
| הציונים שלי | `GET /me/grades?subjectId=&periodId=` |
| הנוכחות שלי | `GET /me/attendance?status=&approved=&subjectId=&from=&to=` |
| מערכת השעות | `GET /schedule/me` |

### מנהלת

המנהלת יכולה להשתמש בכל מסכי המורה, בכל השיבוצים של בית הספר.

| מסך | נתיבים |
| --- | --- |
| כיתות | `GET /classes`, `POST /classes`, `PATCH /classes/{id}`, `DELETE /classes/{id}` |
| מקצועות | `GET /subjects`, `POST /subjects`, `PATCH /subjects/{id}`, `DELETE /subjects/{id}` |
| מורות / תלמידות | `GET /users?role=&classId=&firstName=&lastName=&search=&isActive=&sortBy=&order=&page=&pageSize=`, `GET /users/{id}`, `POST /users`, `PATCH /users/{id}`, `POST /users/{id}/reset-password` |
| שיבוצים | `GET /assignments?classId=&teacherId=&subjectId=`, `POST /assignments`, `PATCH /assignments/{id}`, `DELETE /assignments/{id}` |
| מערכת של כיתה / מורה | `GET /classes/{id}/schedule`, `GET /schedule/teachers/{id}` |
| שליחת הודעה (רשות) | `POST /messages`, `GET /messages/sent` |
| ייבוא תלמידות (רשות) | `GET /users/import/template.xlsx`, `POST /users/import`, `GET /users/import/{importId}/passwords.xlsx` |
| ייצוא (רשות) | `GET /exports/students.csv`, `GET /exports/teachers.csv`, `GET /exports/grades.csv?assignmentId=` |

(כל הנתיבים מתחילים ב־`/api`.)

---

## 6. טפסים: שדות חובה וכללי תקינות

כדאי להגדיר את אותם כללים ב־React Hook Form, כדי שהמשתמשת תראה שגיאה עוד לפני השליחה. השרת בודק אותם שוב בכל מקרה.

### כניסה
| שדה | חובה | כלל |
| --- | --- | --- |
| `email` | כן | מייל תקין |
| `password` | כן | לא ריק |

### מבחן (`POST /periods/{periodId}/exams`, `PATCH /exams/{id}`)
| שדה | חובה | כלל |
| --- | --- | --- |
| `title` | כן | 2-80 תווים |
| `date` | כן | `YYYY-MM-DD` |
| `weight` | כן | מספר שלם 1-100. סכום המבחנים בתקופה עד 100% |
| `description` | לא | עד 500 תווים |
| `periodId` | לא (בעריכה) | העברת המבחן לתקופה אחרת באותו שיבוץ |

בתקופה שכבר מלאה (100%) השרת יחזיר **422** `WEIGHT_EXCEEDED`. אפשר לחשב מראש כמה נשאר: `100 - examsWeight` של התקופה (מ־`GET /assignments/{id}/periods`).

### תקופת ציון
| שדה | חובה | כלל |
| --- | --- | --- |
| `name` | כן | 2-30 תווים, לא כפול בשיבוץ |
| `weight` | כן | מספר שלם 0-100. סכום התקופות עד 100% |
| `sortOrder` | לא | סדר הצגה |

### ציונים (`PUT /exams/{id}/grades`)
```json
{
  "grades": [
    { "studentId": 21, "score": 98.5, "evaluation": "כל הכבוד!" },
    { "studentId": 32, "score": 87 },
    { "studentId": 42, "score": null }
  ]
}
```
- `score`: 0-100, עד 2 ספרות אחרי הנקודה. `null` מוחק את הציון.
- `evaluation`: רשות, עד 500 תווים. אם לא שולחים את השדה, ההערכה הקיימת נשמרת. `null` או `""` מוחקים אותה.
- שולחים רק את התלמידות שהשתנו, או את כולן. אין חובה לשלוח את כל הכיתה.
- התשובה: הרשימה המלאה והמעודכנת (כמו `GET`).

### טבלת ציונים שלמה (`PUT /assignments/{id}/grades`)

שומרת ציונים של **כמה מבחנים וכמה תלמידות בבקשה אחת**. מתאים לטבלה שבה השורות הן תלמידות והעמודות הן מבחנים.
```json
{
  "grades": [
    { "examId": 1, "studentId": 21, "score": 95 },
    { "examId": 2, "studentId": 21, "score": 88.5, "evaluation": "יפה מאוד" },
    { "examId": 1, "studentId": 32, "score": null }
  ]
}
```
- שולחים רק את התאים שהשתנו (או את כולם, גם זה עובד).
- `score`: 0-100, עד 2 ספרות אחרי הנקודה. `null` מוחק את הציון.
- `evaluation`: רשות. לא נשלח = ההערכה הקיימת נשמרת.
- התשובה: הטבלה המלאה והמעודכנת, **בדיוק באותו מבנה** כמו `GET /assignments/{id}/final-grades`. כך אפשר להציג אותה מיד.
- מבחן משיבוץ אחר או תלמידה מכיתה אחרת: 400, ולא נשמר כלום.

### נוכחות לשיעור (`PUT /assignments/{id}/attendance`)
```json
{
  "date": "2026-10-20",
  "lessonNumber": 3,
  "records": [
    { "studentId": 21, "status": "LATE" },
    { "studentId": 32, "status": "ABSENT", "approved": true, "reason": "אישור רפואי" }
  ]
}
```
- שולחים **רק חריגות**. תלמידה שלא נשלחה = נוכחת.
- זו כל הרשימה של השיעור: חריגה שהייתה קודם ולא נשלחה עכשיו נמחקת.
- `date` לא יכול להיות בעתיד. `lessonNumber` בין 1 ל־10.
- גם רשימה ריקה (`"records": []`) תקינה: היא אומרת "בדקתי נוכחות, כולן נכחו".
- התשובה זהה ל־`GET .../attendance/lesson`: כל תלמידות הכיתה עם הסימון של כל אחת, ו־`taken: true`.

### שיעור במערכת (`POST /lessons`)
| שדה | חובה | כלל |
| --- | --- | --- |
| `assignmentId` | כן | שיבוץ של המורה |
| `dayOfWeek` | כן | 1 = ראשון ... 6 = שישי |
| `lessonNumber` | כן | 1-10 |
| `room` | לא | עד 30 תווים |

התנגשות (לכיתה או למורה כבר יש שיעור באותו יום ושעה): **409**, עם הסבר ב־`message`.

### משתמשת (`POST /users`, מנהלת)
| שדה | חובה | כלל |
| --- | --- | --- |
| `role` | כן | `TEACHER` או `STUDENT` |
| `firstName`, `lastName` | כן | 2-40 תווים |
| `email` | כן | מייל תקין. אחיות יכולות לחלוק מייל |
| `idNumber` | לתלמידה | תעודת זהות עם ספרת ביקורת תקינה (עד 9 ספרות, השרת משלים אפסים). לא כפולה בבית הספר |
| `password` | לא | לפחות 6 תווים. אם ריק, השרת יוצר סיסמה ומחזיר `generatedPassword` (להציג פעם אחת!) |
| `phone` | לא | ספרות, `-`, `+`, רווחים (7-20) |
| `address` | לא | עד 200 תווים |
| `birthDate` | לתלמידה | `YYYY-MM-DD`, לא בעתיד |
| `classId` | לתלמידה | למורה אסור |

עריכה (`PATCH /users/{id}`): אותם שדות (בלי role ו־password), וגם `isActive: false` להשבתה (במקום מחיקה).

### כיתה (`POST /classes`)
| שדה | חובה | כלל |
| --- | --- | --- |
| `gradeLevel` | כן | 1-12 (4 = ד') |
| `parallel` | כן | 1-10 |
| `schoolYear` | לא | ברירת מחדל: השנה הנוכחית |

### הודעה (`POST /messages`)
| שדה | חובה | כלל |
| --- | --- | --- |
| `title` | כן | 2-100 תווים |
| `body` | כן | עד 2000 תווים |
| `audience` | כן | `ALL` / `TEACHERS` / `STUDENTS` / `CLASS` |
| `classId` | כש־`CLASS` | הכיתה |

---

## 7. דוגמאות תשובה חשובות

### `GET /api/assignments` (מורה)
```json
[
  {
    "id": 1,
    "class": { "id": 1, "name": "ד'1", "gradeLevel": 4, "parallel": 1, "schoolYear": "תשפ״ז" },
    "subject": { "id": 1, "name": "חומש" },
    "teacher": { "id": 2, "firstName": "מרים", "lastName": "כהן" },
    "studentsCount": 23
  }
]
```

### `GET /api/assignments/1/periods`
```json
{
  "items": [
    { "id": 1, "name": "מחצית א'", "weight": 50, "sortOrder": 1, "examsCount": 3, "examsWeight": 100, "isComplete": true },
    { "id": 2, "name": "מחצית ב'", "weight": 50, "sortOrder": 2, "examsCount": 0, "examsWeight": 0, "isComplete": false }
  ],
  "totalWeight": 100,
  "canCalculateAnnual": false,
  "problems": ["במחצית ב' עדיין לא הוגדרו מבחנים"]
}
```

### `GET /api/assignments/1/exams`
```json
[
  {
    "id": 1, "title": "בוחן פרשת בראשית", "date": "2026-09-16", "weight": 20, "description": null,
    "period": { "id": 1, "name": "מחצית א'" }, "assignmentId": 1, "gradesCount": 23, "average": 80.8
  },
  {
    "id": 3, "title": "מבחן מחצית בחומש", "date": "2027-01-13", "weight": 50, "description": null,
    "period": { "id": 1, "name": "מחצית א'" }, "assignmentId": 1, "gradesCount": 0, "average": null
  }
]
```

### `GET /api/exams/1/grades`
```json
{
  "exam": { "id": 1, "title": "בוחן פרשת בראשית", "date": "2026-09-16", "weight": 20, "...": "..." },
  "items": [
    { "student": { "id": 21, "firstName": "לאה", "lastName": "אדלר" }, "score": 80, "evaluation": null },
    { "student": { "id": 43, "firstName": "פרומט", "lastName": "ביננפלד" }, "score": 77.75, "evaluation": null }
  ]
}
```

### `GET /api/assignments/3/final-grades`
```json
{
  "assignment": { "id": 3, "class": { "name": "ד'1", "...": "..." }, "subject": { "id": 3, "name": "דינים" }, "teacher": { "...": "..." } },
  "periods": [
    {
      "id": 5, "name": "מחצית א'", "weight": 50, "examsWeight": 100, "isComplete": true,
      "exams": [
        { "id": 7, "title": "בוחן הלכות ברכות", "date": "2026-09-06", "weight": 20 },
        { "id": 8, "title": "עבודה: הלכות סוכה", "date": "2026-10-06", "weight": 40 },
        { "id": 9, "title": "מבחן הלכות ימים נוראים", "date": "2026-10-14", "weight": 40 }
      ]
    },
    { "id": 6, "name": "מחצית ב'", "weight": 50, "examsWeight": 0, "isComplete": false, "exams": [] }
  ],
  "periodsWeight": 100,
  "canCalculateAnnual": false,
  "problems": ["במחצית ב' עדיין לא הוגדרו מבחנים"],
  "students": [
    {
      "studentId": 21, "firstName": "לאה", "lastName": "אדלר",
      "scores": { "7": 78.5, "8": 80.25, "9": 85 },
      "evaluations": { "7": null, "8": "עבודה יפה", "9": null },
      "periodGrades": { "5": 81.8, "6": null },
      "annualGrade": null
    }
  ]
}
```
- `scores`, `evaluations` ו־`periodGrades` הם אובייקטים שהמפתח שלהם הוא מזהה המבחן / התקופה (כמחרוזת). למשל, הציון של לאה במבחן 8 נמצא ב־`scores["8"]`.
- `null` בציון תקופה = התקופה לא הושלמה. `annualGrade: null` = אי אפשר לחשב עדיין. הסיבה מופיעה ב־`problems`.
- **כללי החישוב:** ציון תקופה = סכום (ציון × משקל) / 100, רק כשמשקלי המבחנים בתקופה = 100%. ציון חסר = 0. ציון שנתי = סכום (ציון תקופה × משקל תקופה) / 100, רק כשמשקלי התקופות = 100% וכל תקופה עם משקל הושלמה. תקופה עם משקל 0% לא נספרת. מעוגל לספרה אחת אחרי הנקודה.

### `GET /api/assignments/1/attendance/lesson?date=2026-10-19&lessonNumber=1`
```json
{
  "date": "2026-10-19",
  "lessonNumber": 1,
  "taken": false,
  "items": [
    { "student": { "id": 21, "firstName": "לאה", "lastName": "אדלר" }, "attendanceId": null, "status": null, "symbol": "", "approved": false, "reason": null },
    { "student": { "id": 32, "firstName": "בתיה", "lastName": "אייזנבך" }, "attendanceId": 773, "status": "ABSENT", "symbol": "-", "approved": true, "reason": "אישור רפואי" }
  ]
}
```

### `GET /api/schedule/me`
מערך שיעורים ממוין לפי יום ושעה. **אותו מבנה** למורה ולתלמידה. ההבדל הוא רק אילו שיעורים חוזרים:
```json
[
  {
    "id": 1, "dayOfWeek": 1, "dayName": "ראשון", "lessonNumber": 1, "room": "חדר 11", "assignmentId": 5,
    "subject": { "id": 5, "name": "חשבון" },
    "class": { "id": 1, "name": "ד'1", "...": "..." },
    "teacher": { "id": 6, "firstName": "חנה", "lastName": "שטרן" }
  }
]
```
כדי לבנות טבלה שבועית: עמודה לכל יום (1-6), שורה לכל שעה (1-10), ובכל תא השיעור עם אותו `dayOfWeek` ו־`lessonNumber`. למורה מציגים בתא את `class.name`, ולתלמידה את `teacher`. כך אותה קומפוננטה משרתת את שתיהן.

### `GET /api/me/grades` (תלמידה)
```json
{
  "subjects": [
    {
      "assignmentId": 3,
      "subject": { "id": 3, "name": "דינים" },
      "teacher": { "id": 2, "firstName": "מרים", "lastName": "כהן" },
      "periods": [
        {
          "id": 5, "name": "מחצית א'", "weight": 50, "examsWeight": 100, "isComplete": true, "grade": 85.9,
          "exams": [
            { "id": 7, "title": "בוחן הלכות ברכות", "date": "2026-09-06", "weight": 20, "score": 84, "evaluation": null },
            { "id": 8, "title": "עבודה: הלכות סוכה", "date": "2026-10-06", "weight": 40, "score": 85.75, "evaluation": null }
          ]
        },
        { "id": 6, "name": "מחצית ב'", "weight": 50, "examsWeight": 0, "isComplete": false, "grade": null, "exams": [] }
      ],
      "annualGrade": null,
      "canCalculateAnnual": false,
      "problems": ["במחצית ב' עדיין לא הוגדרו מבחנים"]
    }
  ]
}
```
לרשימת המקצועות לסינון אפשר להשתמש ב־`subjects[].subject` מהתשובה עצמה.

### `GET /api/me/attendance` (תלמידה)
```json
{
  "items": [
    { "id": 768, "date": "2026-10-20", "lessonNumber": 1, "status": "LATE", "symbol": "+", "label": "איחור",
      "approved": false, "reason": null, "subject": { "id": 4, "name": "לשון" } }
  ],
  "summary": {
    "lessons": 140, "late": 3, "absent": 6, "released": 0, "approved": 0, "attendancePercent": 95.7,
    "bySubject": [
      { "subject": { "id": 1, "name": "חומש" }, "lessons": 27, "late": 1, "absent": 1, "released": 0, "approved": 0, "attendancePercent": 96.3 }
    ]
  }
}
```
אחוז נוכחות = השיעורים בלי חיסור לא מאושר ÷ השיעורים שבהם נבדקה נוכחות.

### `GET /api/messages`
```json
{
  "unreadCount": 2,
  "items": [
    {
      "id": 3, "title": "שבוע הספר", "body": "בשבוע הבא נקיים את שבוע הספר...",
      "audience": "STUDENTS", "audienceLabel": "כל התלמידות", "class": null,
      "sender": { "id": 1, "firstName": "רחל", "lastName": "פרידמן" },
      "createdAt": "2026-10-19T06:45:00.000Z", "isRead": false, "readAt": null
    }
  ]
}
```

### `GET /api/birthdays/today`
```json
{
  "date": "2026-10-20",
  "hebrewDate": "ט׳ חשון תשפ״ז",
  "isMyBirthday": false,
  "items": [
    { "studentId": 13, "firstName": "יוכבד", "lastName": "רוזנברג", "className": "ד'1", "age": 10,
      "hebrewBirthDate": "ט׳ חשון תשע״ז", "greeting": "מזל טוב ליוכבד רוזנברג מכיתה ד'1 ליום הולדתה!" }
  ]
}
```
- מורה: התלמידות שהיא מלמדת. מנהלת: כל בית הספר. תלמידה: רק היא, ו־`isMyBirthday: true` ביום ההולדת שלה (עם `greeting` אישי).
- הטקסט ב־`greeting` מוכן להצגה.
- כדי להדגים בתאריך אחר: `?date=2026-11-10`.

### `GET /api/users` (מנהלת)
```json
{ "items": [ { "id": 21, "role": "STUDENT", "firstName": "לאה", "...": "..." } ], "total": 93, "page": 1, "pageSize": 20 }
```
עימוד: `page` ו־`pageSize` (עד 100). מספר העמודים = `Math.ceil(total / pageSize)`.

---

## 8. הורדת קבצים (ייצוא, קובץ לדוגמה, סיסמאות)

הנתיבים `/exports/*.csv`, `/users/import/template.xlsx` ו־`/users/import/{importId}/passwords.xlsx` מחזירים **קובץ** ולא JSON, והם דורשים Token.

לכן אי אפשר לשים אותם כקישור רגיל (`<a href>`), כי קישור לא שולח את כותרת ה־Authorization. במקום זה:
1. שולחים בקשה רגילה עם הכותרת `Authorization`, ומבקשים לקבל את התשובה כ־**Blob** (קובץ בינארי). ב־fetch משתמשים ב־`response.blob()`, וב־axios ב־`responseType: "blob"`.
2. יוצרים מה־Blob כתובת זמנית בדפדפן (`URL.createObjectURL`) ומפעילים הורדה.
3. שם הקובץ מופיע בכותרת `Content-Disposition` (השרת מאפשר לקרוא אותה).

קובצי ה־CSV נפתחים באקסל עם עברית תקינה.

**הדפסה:** לא צריך שום דבר מהשרת. מציגים את הטבלה בדף, ומפעילים את חלון ההדפסה של הדפדפן (`window.print()`). אפשר להוסיף CSS להדפסה שמסתיר כפתורים ותפריטים.

---

## 9. העלאת קובץ אקסל (ייבוא תלמידות)

`POST /api/users/import` מקבל **multipart/form-data** (לא JSON):
- שדה אחד בשם `file` עם קובץ `.xlsx`, עד 2MB.
- בונים אובייקט `FormData` ומוסיפים לו את הקובץ שנבחר ב־`<input type="file">`. **לא** מגדירים `Content-Type` בעצמך, הדפדפן עושה זאת.

תשובה מוצלחת (201):
```json
{
  "created": 2,
  "importId": "6f1c2a4e-...",
  "students": [
    { "id": 120, "firstName": "אסתר", "lastName": "ייבוא", "className": "ד'1", "email": "import.family@example.com", "password": "kd7mx4pa" }
  ]
}
```
אפשר להציג את הסיסמאות בטבלה, או להוריד אותן כאקסל מ־`/users/import/{importId}/passwords.xlsx` (הורדה אחת, עד 30 דקות).

תשובה עם שגיאות (400, **לא נשמר כלום**):
```json
{
  "error": {
    "code": "IMPORT_VALIDATION_ERROR",
    "message": "נמצאו 2 שגיאות בקובץ. לא נשמר דבר.",
    "details": [
      { "row": 3, "field": "שם פרטי", "message": "שדה חובה" },
      { "row": 4, "field": "כיתה", "message": "הכיתה \"ד'9\" לא קיימת במערכת" }
    ]
  }
}
```

---

## 10. מה מחזירים פעולות שונות

| פעולה | קוד | גוף התשובה |
| --- | --- | --- |
| יצירה (`POST`) | 201 | האובייקט שנוצר |
| עריכה (`PATCH`) | 200 | האובייקט המעודכן |
| מחיקה (`DELETE`), סימון הודעה כנקראה, שינוי סיסמה | 204 | ריק |
| תקופות (POST/PATCH) | 201/200 | כל רשימת התקופות המעודכנת (`items`, `totalWeight`...) |
| שמירת ציונים / נוכחות (`PUT`) | 200 | הרשימה המלאה המעודכנת |

**אחרי שמירה:** כדאי לרענן את הנתונים שהשתנו. למשל, אחרי הוספת מבחן לרענן את רשימת המבחנים ואת התקופות (כי `examsWeight` השתנה). אחרי שמירת ציונים לרענן גם את הציונים הסופיים.

---

## 11. טבלת הרשאות

| פעולה | מנהלת | מורה | תלמידה |
| --- | --- | --- | --- |
| כניסה, פרטים, שינוי סיסמה, תיבת הודעות, ימי הולדת | כן | כן | כן |
| ניהול כיתות, מקצועות, שיבוצים ומשתמשות | כן | - | - |
| צפייה בכיתות ובתלמידות | הכול | רק הכיתות שלה | - |
| תקופות, מבחנים, ציונים, ציונים סופיים | הכול | רק השיבוצים שלה | - |
| נוכחות | הכול | רק השיבוצים שלה | - |
| שיעורים במערכת | הכול | רק השיבוצים שלה | - |
| המערכת שלי | כן | השיעורים שלה | מערכת הכיתה |
| הציונים / הנוכחות שלי | - | - | כן |
| שליחת הודעות | כן | - | - |
| ייצוא | הכול | הכיתות/השיבוצים שלה | - |
| ייבוא מאקסל | כן | - | - |

---

## 12. חשבונות להדגמה

ראי את הטבלה ב־[README.md](README.md#חשבונות-להדגמה). במחשב הסיסמה היא `Demo1234!`, ולאחות הגדולה `Demo1234!2`.
