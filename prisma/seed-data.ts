/**
 * נתוני הדגמה מומצאים לבית ספר לבנות.
 * כל השמות, הטלפונים, הכתובות והמיילים מומצאים. כתובות המייל משתמשות
 * בסיומות example שלא קיימות באמת, כך שלא יישלח דבר לאף אחד.
 */

export const SCHOOL_DOMAIN = "bais-yaakov-demo.example";

export const MAIN_SCHOOL = { name: "בית יעקב 'עטרת שרה'", city: "בני ברק" };
export const SECOND_SCHOOL = { name: "בית ספר לבנות 'בית חנה'", city: "ירושלים" };

export const SUBJECTS = ["חומש", "נביא", "דינים", "לשון", "חשבון", "אנגלית", "טבע", "ידיעת הארץ"] as const;
export type SubjectName = (typeof SUBJECTS)[number];

/** שעות שבועיות לכל מקצוע (26 שעות בשבוע לכיתה) */
export const WEEKLY_HOURS: Record<SubjectName, number> = {
  חומש: 5,
  נביא: 3,
  דינים: 2,
  לשון: 4,
  חשבון: 5,
  אנגלית: 3,
  טבע: 2,
  "ידיעת הארץ": 2,
};

/** הכיתות: שכבה ד' (4) ושכבה ה' (5), שתי מקבילות בכל שכבה */
export const CLASSES = [
  { gradeLevel: 4, parallel: 1 },
  { gradeLevel: 4, parallel: 2 },
  { gradeLevel: 5, parallel: 1 },
  { gradeLevel: 5, parallel: 2 },
] as const;

export interface TeacherSeed {
  key: string;
  firstName: string;
  lastName: string;
  emailLocal: string;
  phone: string;
  /** מחנכת: מלמדת חומש, נביא, דינים ולשון בכיתה שלה */
  homeroom?: { gradeLevel: number; parallel: number };
  /** מורה מקצועית: מקצוע וכיתות */
  specialist?: { subject: SubjectName; classes: Array<{ gradeLevel: number; parallel: number }> };
  demo?: boolean;
}

const ALL_CLASSES = CLASSES.map((c) => ({ ...c }));

export const PRINCIPAL = {
  firstName: "רחל",
  lastName: "פרידמן",
  emailLocal: "menahelet",
  phone: "03-5701234",
};

export const TEACHERS: TeacherSeed[] = [
  { key: "cohen", firstName: "מרים", lastName: "כהן", emailLocal: "miriam.cohen", phone: "052-7614382", homeroom: { gradeLevel: 4, parallel: 1 }, demo: true },
  { key: "levi", firstName: "אסתר", lastName: "לוי", emailLocal: "esther.levi", phone: "054-8423197", homeroom: { gradeLevel: 4, parallel: 2 } },
  { key: "weiss", firstName: "שרה", lastName: "ויס", emailLocal: "sara.weiss", phone: "053-3197246", homeroom: { gradeLevel: 5, parallel: 1 } },
  { key: "greenberg", firstName: "רבקה", lastName: "גרינברג", emailLocal: "rivka.greenberg", phone: "052-7680413", homeroom: { gradeLevel: 5, parallel: 2 } },
  {
    key: "stern",
    firstName: "חנה",
    lastName: "שטרן",
    emailLocal: "chana.stern",
    phone: "054-8461530",
    specialist: { subject: "חשבון", classes: [{ gradeLevel: 4, parallel: 1 }, { gradeLevel: 4, parallel: 2 }] },
  },
  {
    key: "friedlander",
    firstName: "לאה",
    lastName: "פרידלנדר",
    emailLocal: "leah.friedlander",
    phone: "050-4172839",
    specialist: { subject: "חשבון", classes: [{ gradeLevel: 5, parallel: 1 }, { gradeLevel: 5, parallel: 2 }] },
  },
  {
    key: "horowitz",
    firstName: "דבורה",
    lastName: "הורוביץ",
    emailLocal: "dvora.horowitz",
    phone: "052-7139054",
    specialist: { subject: "אנגלית", classes: ALL_CLASSES },
    demo: true,
  },
  { key: "berger", firstName: "יהודית", lastName: "ברגר", emailLocal: "yehudit.berger", phone: "058-3247610", specialist: { subject: "טבע", classes: ALL_CLASSES } },
  { key: "klein", firstName: "בתיה", lastName: "קליין", emailLocal: "batya.klein", phone: "053-4128765", specialist: { subject: "ידיעת הארץ", classes: ALL_CLASSES } },
];

export const STUDENT_FIRST_NAMES = [
  "שרה", "רבקה", "רחל", "לאה", "חיה", "מרים", "אסתר", "חנה", "יהודית", "דבורה", "בתיה", "נחמה",
  "פנינה", "טובה", "מלכה", "שושנה", "ציפורה", "הדסה", "תמר", "ברכה", "שפרה", "גיטי", "חוי", "מירי",
  "אפרת", "אהובה", "בילא", "אסתי", "חני", "רחלי", "מיכל", "יוכבד", "שולמית", "רינה", "אלישבע", "נעמי",
  "פייגי", "רייזי", "ציפי", "דבורי", "שיפי", "יעלי", "אודיה", "הודיה", "אורה", "זיסל", "פרומט", "טובי",
];

/** שם משפחה בעברית + אותיות לועזיות לכתובת המייל של ההורים */
export const FAMILY_NAMES: Array<[string, string]> = [
  ["רוזנברג", "rosenberg"], ["שפירא", "shapira"], ["רבינוביץ", "rabinovitz"], ["פרל", "perl"], ["אדלר", "adler"],
  ["וקסלר", "wexler"], ["בלום", "blum"], ["לנדאו", "landau"], ["טייטלבוים", "teitelbaum"], ["זילברמן", "zilberman"],
  ["הלפרין", "halperin"], ["פוקס", "fuchs"], ["אייזנבך", "eisenbach"], ["גוטמן", "gutman"], ["ויסמן", "weissman"],
  ["שלזינגר", "schlesinger"], ["גולדשמידט", "goldschmidt"], ["ברנשטיין", "bernstein"], ["רוטשטיין", "rothstein"], ["מנדלסון", "mendelson"],
  ["פישר", "fischer"], ["קרויזר", "kreuzer"], ["אפשטיין", "epstein"], ["ביננפלד", "binenfeld"], ["הירש", "hirsch"],
  ["וולף", "wolf"], ["יעקובוביץ", "yakobovitz"], ["מרקוביץ", "markovitz"], ["דויטש", "deutsch"], ["נוסבאום", "nussbaum"],
  ["ליכטנשטיין", "lichtenstein"], ["טננבוים", "tenenbaum"], ["אוסטרייכר", "oestreicher"], ["גרוס", "gross"], ["שוורץ", "schwartz"],
  ["מזרחי", "mizrahi"], ["עזרא", "ezra"], ["פרץ", "peretz"], ["אוחיון", "ohayon"], ["ביטון", "biton"],
  ["דהן", "dahan"], ["יוסף", "yosef"], ["חדד", "hadad"], ["אלבז", "elbaz"], ["אבוטבול", "abutbul"],
  ["סויסה", "suissa"], ["טולדנו", "toledano"], ["אזולאי", "azulay"], ["בן שמעון", "benshimon"], ["כץ", "katz"],
  ["גלבר", "gelber"], ["קופרמן", "kuperman"], ["ברייער", "breuer"], ["הכט", "hecht"], ["זלצר", "zeltzer"],
  ["שטיינמץ", "steinmetz"], ["רייכמן", "reichman"], ["וינברגר", "weinberger"], ["שטרנבוך", "sternbuch"], ["אורנשטיין", "ornstein"],
  ["גרליץ", "gerlitz"], ["פלדמן", "feldman"], ["קרמר", "kramer"], ["סגל", "segal"], ["מילר", "miller"],
  ["נויבירט", "neubirt"], ["קורנבליט", "kornblit"], ["שיינברג", "scheinberg"], ["ברוידא", "broide"], ["לייפר", "leifer"],
  ["פינקלשטיין", "finkelstein"], ["זוננפלד", "sonnenfeld"], ["האגר", "hager"], ["גנץ", "gantz"], ["טויבר", "tauber"],
  ["רוט", "roth"], ["לוינשטיין", "levinstein"], ["אורבך", "auerbach"], ["כהנא", "kahane"], ["בורנשטיין", "bornstein"],
];

export const STREETS = [
  "רבי עקיבא", "חזון איש", "ז'בוטינסקי", "הרב קוק", "דסלר", "אהרונוביץ", "השומר", "עזרא", "רשב\"ם", "ירושלים",
  "הרב שך", "בירנבוים", "סוקולוב", "הרב כהנמן", "מהרש\"ל", "ר' מאיר", "חברון", "יהושע", "אבוחצירא", "הרב לנדא",
];

export const PHONE_PREFIXES = ["050", "052", "053", "054", "055", "058", "03"];

/** המשפחה של אחיות ההדגמה: אחת בד'1 ואחת בה'1, עם אותו מייל של ההורים */
export const DEMO_SISTERS = {
  lastName: "גולדברג",
  emailLocal: "goldberg.family",
  younger: { firstName: "חיה", gradeLevel: 4, parallel: 1, birthDate: "2017-02-08" },
  older: { firstName: "רחל", gradeLevel: 5, parallel: 1, birthDate: "2016-01-21" },
  address: "רחוב חזון איש 41, בני ברק",
  phone: "052-7643108",
};

/** כותרות מבחנים לכל מקצוע במחצית א' */
export const EXAM_TITLES: Record<SubjectName, [string, string, string]> = {
  חומש: ["בוחן פרשת בראשית", "מבחן פרשת נח", "מבחן מחצית בחומש"],
  נביא: ["בוחן יהושע פרק א'", "מבחן יהושע פרקים א'-ג'", "מבחן מחצית בנביא"],
  דינים: ["בוחן הלכות ברכות", "עבודה: הלכות סוכה", "מבחן הלכות ימים נוראים"],
  לשון: ["הבנת הנקרא", "חיבור: חוויה מהחג", "מבחן מחצית בלשון"],
  חשבון: ["בוחן לוח הכפל", "מבחן חילוק ארוך", "מבחן מחצית בחשבון"],
  אנגלית: ["Vocabulary Quiz 1", "Reading Test - Unit 1", "Mid-term Test"],
  טבע: ["בוחן מחזור המים", "עבודה: הצמח וחלקיו", "מבחן מחצית בטבע"],
  "ידיעת הארץ": ["מבחן מפת ארץ ישראל", "עבודה: ערי ארץ ישראל", "מבחן סיכום: הרים ועמקים"],
};

export const EVALUATIONS = [
  "כל הכבוד!",
  "עבודה יפה ומסודרת",
  "השתפרה מאוד",
  "יש להקפיד על כתב ברור",
  "מומלץ לחזור על החומר",
  "השקעה ניכרת",
  "תשובות מלאות ומדויקות",
  "יש להקפיד לקרוא את השאלה עד הסוף",
  "התקדמות יפה, להמשיך כך",
  "חסרו הסברים בחלק ב'",
];

export const ABSENCE_REASONS = ["מחלה", "אישור רפואי", "שמחה משפחתית", "נסיעה משפחתית"];
export const RELEASE_REASONS = ["תור לרופא", "בקשת ההורים", "שמחה משפחתית"];

/**
 * ימים ללא לימודים בתחילת שנת תשפ״ז (ספטמבר-אוקטובר 2026):
 * ערב ראש השנה וראש השנה, ערב יום כיפור ויום כיפור, וחופשת סוכות.
 */
export const NO_SCHOOL_DATES = new Set<string>([
  "2026-09-11", "2026-09-13",
  "2026-09-20", "2026-09-21",
  "2026-09-25", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30",
  "2026-10-01", "2026-10-02", "2026-10-04",
]);

export const SCHOOL_YEAR_START = "2026-09-01";
