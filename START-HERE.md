# מתחילים כאן: איך מעלים את השרת לאינטרנט

המדריך הזה מיועד למי שמעולם לא העלתה שרת לאינטרנט. עושים את השלבים לפי הסדר.

**מה נעשה:**
1. **GitHub**: נעלה את קבצי הפרויקט (שם המורה תראה את הקוד).
2. **Neon**: ניצור מסד נתונים PostgreSQL חינמי בענן.
3. **Render**: נפעיל את השרת בענן, מחובר ל־GitHub ול־Neon.
4. **בדיקה**: נוודא שהכול עובד דרך Swagger.

> **הערה חשובה:** אתרים משנים מדי פעם את העיצוב ואת שמות הכפתורים. כתבתי כאן את השמות כפי שהם מופיעים בתיעוד של האתרים, אבל לא יכולתי לבדוק כל מסך בעצמי. אם כפתור נקרא קצת אחרת, חפשי את הכפתור הכי דומה.

> **עלויות:** כל השירותים כאן חינמיים במסלול הבסיסי, אבל יש להם מגבלות (מפורטות בכל חלק). לא צריך לשלם כדי להגיש את הפרויקט.

---

## חלק א: GitHub

### 1. פתיחת חשבון
1. נכנסים ל־https://github.com
2. לוחצים **Sign up**.
3. ממלאים מייל, סיסמה ושם משתמש, ומאשרים את המייל.

### 2. יצירת Repository (מאגר קוד)
1. אחרי ההתחברות, לוחצים על **+** בפינה העליונה ← **New repository**.
2. **Repository name**: `school-backend`.
3. בוחרים **Public** (כדי שהמורה תוכל לראות), או **Private** ואז מוסיפים את המורה לפי ההנחיות שלה.
4. **לא** מסמנים "Add a README file" (כבר יש לנו).
5. לוחצים **Create repository**.

### 3. חילוץ קובץ ה־ZIP
1. מורידים את קובץ ה־ZIP למחשב.
2. ב־Windows: לחיצה ימנית על הקובץ ← **Extract All** (חלץ הכול) ← **Extract**.
3. נוצרת תיקייה `backend-project`. בתוכה נמצאים `src`, `prisma`, `package.json` וכו'.

### 4. העלאת הקבצים דרך הדפדפן
1. בעמוד של ה־Repository החדש, לוחצים על הקישור **uploading an existing file**.
2. פותחים את התיקייה `backend-project` במחשב, מסמנים **את כל מה שבתוכה** (Ctrl+A) וגוררים לחלון של GitHub.
   - חשוב: גוררים את **התוכן** של התיקייה, לא את התיקייה עצמה, כדי ש־`package.json` יהיה בשורש ה־Repository.
3. מחכים שכל הקבצים יעלו.
4. למטה, ב־**Commit changes**, לוחצים **Commit changes**.

### 5. בדיקה שהקבצים נמצאים ב־GitHub
בעמוד הראשי של ה־Repository צריך לראות: התיקיות `src`, `prisma`, `scripts`, `tests`, `docs`, והקבצים `package.json`, `package-lock.json`, `render.yaml`, `README.md`, `.gitignore`, `.env.example`.

- **אם הקובץ `.gitignore` או `.env.example` חסר** (לפעמים קבצים שמתחילים בנקודה לא נגררים): לוחצים **Add file** ← **Create new file**, כותבים את השם (למשל `.gitignore`), מעתיקים את התוכן מהקובץ שבמחשב (פותחים אותו ב־Notepad), ולוחצים **Commit changes**.
- **אסור שיופיעו** התיקייה `node_modules` או קובץ בשם `.env`. אם העלית בטעות קובץ `.env`, מחקי אותו מ־GitHub ושני את הסיסמאות שהיו בו.

---

## חלק ב: מסד נתונים ב־Neon

למה Neon ולא מסד הנתונים של Render? מסד הנתונים החינמי של Render נמחק 30 יום אחרי שיוצרים אותו. ב־Neon המסלול החינמי לא מוגבל בזמן (עם מגבלה של 0.5GB, הרבה יותר ממה שצריך לפרויקט הזה). מסד הנתונים ב־Neon "נרדם" אחרי כמה דקות בלי שימוש ומתעורר לבד בבקשה הבאה.

### 1. פתיחת חשבון
1. נכנסים ל־https://neon.com ולוחצים **Sign up**.
2. אפשר להירשם עם חשבון ה־GitHub שפתחת.

### 2. יצירת Database
1. יוצרים פרויקט חדש (**Create project** / **New Project**).
2. **Project name**: `school`.
3. **Postgres version**: הגרסה שמוצעת כברירת מחדל.
4. **Region**: אזור באירופה (למשל Frankfurt), קרוב לשרת שנפתח ב־Render.
5. יוצרים את הפרויקט. נוצר אוטומטית מסד נתונים בשם `neondb`.

### 3. קבלת Connection String (כתובת החיבור)
1. בתוך הפרויקט לוחצים על **Connect**.
2. בחלון שנפתח בוחרים את ה־Branch (ברירת המחדל) ואת מסד הנתונים `neondb`.
3. **מכבים את Connection pooling** (כדי לקבל כתובת "ישירה", שמתאימה ל־Prisma Migrations).
4. לוחצים על אייקון ההעתקה ליד הכתובת. היא נראית בערך כך:
   `postgresql://neondb_owner:XXXXXXXX@ep-xxxx-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`

### 4. שמירה בבטחה
- הכתובת כוללת סיסמה. **אל תשימי אותה ב־GitHub, בצ'אט או בקוד.**
- שמרי אותה זמנית בקובץ טקסט במחשב שלך בלבד. נדביק אותה ב־Render בחלק הבא.

### 5. חיבור השרת למסד הנתונים
החיבור נעשה דרך משתנה הסביבה `DATABASE_URL` ב־Render (חלק ג, שלב 6). בהפעלה הראשונה השרת ייצור לבד את כל הטבלאות וימלא אותן בנתוני ההדגמה.

---

## חלק ג: Render

**מגבלות המסלול החינמי:** אם לא נכנסים לשרת 15 דקות, Render "מרדים" אותו, והבקשה הבאה לוקחת בערך דקה עד שהוא מתעורר. זה תקין. כדאי לפתוח את האתר כמה דקות לפני שמציגים אותו למורה.

### 1. פתיחת חשבון
1. נכנסים ל־https://render.com ולוחצים **Get Started** / **Sign Up**.
2. נרשמים עם **GitHub** (הכי נוח, כי כך החיבור ל־GitHub כבר קיים).

### 2. חיבור GitHub
אם נרשמת עם GitHub, Render יבקש אישור לגשת ל־Repositories. אפשר לאשר רק את `school-backend`.

### 3. יצירת Web Service
1. בלוח הבקרה לוחצים **New** (או **+ New**) ← **Web Service**.
2. בוחרים **Git Provider** / **GitHub**.

### 4. בחירת ה־Repository
בוחרים את `school-backend` ולוחצים **Connect**.

### 5. הגדרות Build ו־Start
ממלאים בדיוק כך:

| שדה | ערך |
| --- | --- |
| **Name** | `school-backend` (השם יהיה חלק מהכתובת) |
| **Region** | `Frankfurt (EU Central)` |
| **Branch** | `main` |
| **Root Directory** | להשאיר ריק |
| **Runtime / Language** | `Node` |
| **Build Command** | `npm ci --include=dev && npm run build` |
| **Start Command** | `npm run start:prod` |
| **Instance Type** | `Free` |

### 6. משתני סביבה
באזור **Environment Variables** לוחצים **Add Environment Variable** ומוסיפים כל שורה:

| Key | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `22` |
| `DATABASE_URL` | הכתובת מ־Neon (חלק ב, שלב 3) |
| `JWT_SECRET` | מחרוזת אקראית ארוכה (לפחות 32 תווים). אפשר ללחוץ **Generate** אם יש כפתור כזה |
| `JWT_EXPIRES_IN` | `8h` |
| `CORS_ORIGINS` | בינתיים `*`. אחרי שתעלי את אתר ה־React, החליפי לכתובת שלו |
| `SEED_DEMO_PASSWORD` | סיסמה שתבחרי לחשבונות ההדגמה, לפחות 8 תווים, למשל `Atara-2026!` |
| `SEED_ON_START` | `true` |

> בלי `SEED_DEMO_PASSWORD` השרת יעבוד, אבל לא ייצור נתוני הדגמה (כדי שלא יהיו באינטרנט חשבונות עם סיסמה שכולם יודעים).

### 7. Prisma Migrations
לא צריך לעשות כלום. פקודת ההפעלה `npm run start:prod` מריצה `prisma migrate deploy` בכל הפעלה. הפקודה יוצרת את הטבלאות בפעם הראשונה ומעדכנת אותן אם יש Migration חדשה.

### 8. Health Check ו־Deploy
1. באזור **Advanced**, אם יש שדה **Health Check Path**, כתבי: `/api/health`.
2. לוחצים **Deploy Web Service** (או **Create Web Service**).
3. Render מתחיל לבנות. אפשר לראות את ההתקדמות בלשונית **Logs**. בפעם הראשונה זה לוקח כמה דקות.
4. כשרואים בלוג `השרת פועל` ו־`נתוני ההדגמה נוצרו בהצלחה`, השרת מוכן.

> **דרך חלופית (Blueprint):** בפרויקט יש קובץ `render.yaml` עם כל ההגדרות. אפשר לבחור **New** ← **Blueprint**, לבחור את ה־Repository, ו־Render ימלא את ההגדרות לבד. יישאר רק למלא `DATABASE_URL`, `CORS_ORIGINS` ו־`SEED_DEMO_PASSWORD`.

### 9. בדיקה שהשרת פעיל
בראש העמוד של השירות מופיעה הכתובת שלו, למשל `https://school-backend-xxxx.onrender.com`. בהמשך נקרא לה **כתובת השרת**.

---

## חלק ד: בדיקה

### 1. בדיקת בריאות
פותחים בדפדפן: `כתובת השרת/api/health`
אמור להופיע: `{"status":"ok","database":"ok",...}`
אם מופיע `"database":"error"`, בעיה בחיבור למסד הנתונים (ראי חלק ה).

### 2. פתיחת Swagger
פותחים: `כתובת השרת/api-docs`
מופיע דף עם כל הנתיבים של השרת, מחולקים לפי נושאים.

### 3. התחברות מתוך Swagger
1. פותחים את **התחברות** ← `POST /api/auth/login`.
2. לוחצים **Try it out**.
3. בתיבה כותבים (עם הסיסמה שהגדרת ב־`SEED_DEMO_PASSWORD`):
   ```json
   { "email": "menahelet@bais-yaakov-demo.example", "password": "הסיסמה-שבחרת" }
   ```
4. לוחצים **Execute**.

### 4. קבלת JWT
בתשובה (Response body) מופיע `"token": "eyJ..."`. מעתיקים את כל הערך שבין המירכאות.

### 5. שימוש ב־Authorize
1. גוללים למעלה ולוחצים על הכפתור **Authorize** (עם המנעול).
2. מדביקים את ה־token בשדה **Value** (בלי המילה Bearer).
3. לוחצים **Authorize** ואז **Close**.

### 6. קריאה ל־Endpoint מוגן
פותחים **כיתות** ← `GET /api/classes` ← **Try it out** ← **Execute**.
אמורה לחזור רשימת הכיתות ד'1, ד'2, ה'1, ה'2.

**בדיקת הרשאות:**
- לוחצים **Authorize** ← **Logout**, ומריצים שוב: מתקבל **401** (אין Token).
- מתחברים כתלמידה (`goldberg.family@example.com` עם הסיסמה שבחרת), שמים את ה־Token שלה ב־Authorize ומריצים `GET /api/users`: מתקבל **403** (אין הרשאה).

### 7. הוספת רשומה
מחוברת כמנהלת:
1. `GET /api/assignments` ← Execute. בוחרים שיבוץ ורושמים את ה־`id` שלו.
2. `GET /api/assignments/{id}/periods` עם ה־id הזה. רושמים את ה־`id` של "מחצית ב'".
3. `POST /api/periods/{id}/exams` עם ה־id של התקופה, ובגוף:
   ```json
   { "title": "מבחן ניסיון", "date": "2027-02-10", "weight": 30 }
   ```
   מתקבל **201** עם המבחן החדש.

### 8. שליפת הרשומה ממסד הנתונים
`GET /api/assignments/{id}/exams` עם ה־id של השיבוץ. המבחן "מבחן ניסיון" מופיע ברשימה. הוא נשמר במסד הנתונים ב־Neon.

---

## חלק ה: פתרון תקלות

| תקלה | מה רואים | פתרון |
| --- | --- | --- |
| **Build Failed** | הבנייה נכשלת בלוג של Render | בדקי ש־`package.json` ו־`package-lock.json` נמצאים בשורש ה־Repository (לא בתוך תיקייה נוספת). בדקי ש־Build Command הוא בדיוק `npm ci --include=dev && npm run build`. |
| **DATABASE_URL שגוי** | בלוג: `P1001` / `Can't reach database` / `password authentication failed`, או ב־health: `"database":"error"` | העתיקי שוב את הכתובת מ־Neon (כפתור Connect), בלי רווחים ובלי מירכאות, עם `?sslmode=require` בסוף. עדכני ב־Render ← Environment ← שמירה. Render יפעיל מחדש. |
| **בעיית Prisma** | בלוג: `prisma migrate deploy` נכשל | ודאי שהתיקייה `prisma/migrations` הועלתה ל־GitHub עם הקובץ `migration_lock.toml`. השתמשי בכתובת Neon **בלי** pooling. |
| **JWT_SECRET חסר** | בלוג: `JWT_SECRET חייב להיות באורך 32 תווים לפחות` | הוסיפי ב־Environment את `JWT_SECRET` עם מחרוזת של 32 תווים ומעלה. |
| **שגיאת CORS** | בדפדפן (F12 ← Console) באתר ה־React: `blocked by CORS policy` | ב־Render עדכני את `CORS_ORIGINS` לכתובת המדויקת של אתר ה־React, בלי `/` בסוף, למשל `https://school-client.onrender.com`. כמה כתובות: מפרידים בפסיק. |
| **401** | `UNAUTHORIZED` / `INVALID_TOKEN` / `TOKEN_EXPIRED` | לא נשלח Token, הוא שגוי, או שפג תוקפו (אחרי 8 שעות). התחברי מחדש ושימי את ה־Token החדש ב־Authorize. ב־React: ודאי שנשלחת הכותרת `Authorization: Bearer <token>`. |
| **403** | `FORBIDDEN` | למשתמשת אין הרשאה לפעולה (למשל תלמידה שמנסה לראות רשימת משתמשות, או מורה בשיבוץ של מורה אחרת). זה תקין, זו ההגנה. |
| **Swagger לא נפתח** | דף ריק או שגיאה ב־`/api-docs` | ודאי שהשרת פעיל (`/api/health`). בפעם הראשונה אחרי "שינה" זה לוקח עד דקה. נסי לרענן. |
| **השרת לא עולה** | הסטטוס ב־Render הוא Failed, או ש־Deploy נתקע | פתחי **Logs** וחפשי את השורה האדומה הראשונה. בדרך כלל חסר משתנה סביבה (`DATABASE_URL`, `JWT_SECRET`). אחרי תיקון: **Manual Deploy** ← **Deploy latest commit**. |
| **אין נתוני הדגמה** | ההתחברות נכשלת, בלוג: `חובה להגדיר SEED_DEMO_PASSWORD` | הוסיפי `SEED_DEMO_PASSWORD` (8 תווים לפחות) ו־`SEED_ON_START=true`, והפעילי מחדש. הנתונים נוצרים רק כשהמסד ריק. |
| **השרת איטי מאוד בבקשה הראשונה** | המתנה של כחצי דקה עד דקה | זה תקין במסלול החינמי של Render: השרת "התעורר משינה". |

---

## בונוס: העלאת אתר ה־React ל־Render

כשאתר ה־React (Vite) מוכן ונמצא ב־Repository נפרד ב־GitHub:

1. ב־Render: **New** ← **Static Site** ← בוחרים את ה־Repository של ה־React.
2. **Build Command**: `npm install && npm run build`
3. **Publish Directory**: `dist`
4. **Environment Variables**: `VITE_API_URL` = כתובת השרת (למשל `https://school-backend-xxxx.onrender.com`).
5. כדי ש־React Router יעבוד כשמרעננים דף: בהגדרות האתר ← **Redirects/Rewrites** ← הוספת כלל: Source `/*`, Destination `/index.html`, Action **Rewrite**.
6. אחרי שהאתר עולה, מעתיקים את הכתובת שלו, ובשרת (ה־Web Service) מעדכנים את `CORS_ORIGINS` לכתובת הזו.

**להגשה:** קישור ל־GitHub של השרת, קישור ל־GitHub של ה־React, וקישור לאתר בענן. כך המורה רואה את השרת, את מסד הנתונים ואת הלקוח.
