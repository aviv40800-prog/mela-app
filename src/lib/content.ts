// Shared, client-safe content: cultural prompts, "This or That" quiz, icebreakers and plans.

export const CULTURAL_PROMPTS = [
  { key: "buna", question: "טקס הבונה המושלם בשבילי כולל..." },
  { key: "family_value", question: "הערך מהבית שאני הכי גאה להמשיך..." },
  { key: "sigd", question: "ביום סיגד את/ה תמצא/י אותי..." },
  { key: "grandma_dish", question: "המאכל של סבתא שאין עליו..." },
  { key: "eskista", question: "השיר שתמיד מוציא ממני אסקסטה..." },
  { key: "two_worlds", question: "בין הבית האתיופי לרחוב הישראלי, אני..." },
  { key: "amharic_word", question: "המילה באמהרית שהכי מתארת אותי..." },
  { key: "first_date", question: "הדייט הראשון המושלם שלנו ייראה כך..." },
  { key: "dealbreaker", question: "אני מחפש/ת מישהו/י ש..." },
] as const;

export type PromptKey = (typeof CULTURAL_PROMPTS)[number]["key"];

export function promptQuestion(key: string): string {
  return CULTURAL_PROMPTS.find((p) => p.key === key)?.question ?? key;
}

/** "This or That": a mix of heritage ("culture") and everyday ("general") questions. Order = onboarding order. */
export const QUIZ_QUESTIONS = [
  { key: "coffee", cat: "culture", a: "בונה בג'בנה", b: "אספרסו כפול" },
  { key: "morning", cat: "general", a: "ציפור בוקר", b: "ינשוף לילה" },
  { key: "bread", cat: "culture", a: "אינג'רה", b: "פיתה" },
  { key: "weekend", cat: "general", a: "בית ונטפליקס", b: "יוצאים לבלות" },
  { key: "music", cat: "culture", a: "טדי אפרו", b: "מזרחית ישראלית" },
  { key: "texting", cat: "general", a: "הודעות קוליות", b: "הודעות כתובות" },
  { key: "wedding", cat: "culture", a: "חתונה של 800 איש", b: "חתונה אינטימית" },
  { key: "vacation", cat: "general", a: "טבע ושקט", b: "עיר תוססת" },
  { key: "shabbat", cat: "culture", a: "שישי אצל ההורים", b: "סופ״ש בצפון" },
  { key: "pets", cat: "general", a: "כלבים", b: "חתולים" },
  { key: "dance", cat: "culture", a: "אסקסטה עד הבוקר", b: "סלואו בפינה" },
  { key: "sport", cat: "general", a: "חדר כושר", b: "ריצה בפארק" },
  { key: "trip", cat: "culture", a: "טיול שורשים לגונדר", b: "חופשה ביוון" },
  { key: "money", cat: "general", a: "חוסכים לעתיד", b: "חיים את הרגע" },
  { key: "dinner", cat: "culture", a: "דורו וואט", b: "שקשוקה" },
  { key: "city", cat: "general", a: "תל אביב", b: "ירושלים" },
  { key: "plans", cat: "general", a: "מתכננים הכל", b: "זורמים" },
  { key: "kids", cat: "general", a: "משפחה גדולה", b: "משפחה קטנה" },
] as const;

/**
 * "Improve your profile" bank — released a few at a time (see lib/checkin.ts). Same this-or-that format,
 * stored in quiz_answers, so every answer feeds compatibility.
 */
export const BONUS_QUESTIONS = [
  { key: "home_trad", cat: "values", a: "בית שומר מסורת", b: "בית חילוני" },
  { key: "career", cat: "values", a: "קריירה קודם", b: "משפחה קודם" },
  { key: "honesty", cat: "values", a: "אמת גם כשכואב", b: "עדינות לפני הכל" },
  { key: "near_parents", cat: "values", a: "לגור קרוב להורים", b: "קצת מרחק בריא" },
  { key: "kids_amharic", cat: "values", a: "הילדים ידברו אמהרית", b: "עברית זה מספיק" },
  { key: "community", cat: "values", a: "מעורב/ת בקהילה", b: "שומר/ת על פרטיות" },
  { key: "first_move", cat: "relationship", a: "אני כותב/ת ראשון/ה", b: "מחכה שיכתבו לי" },
  { key: "texting_day", cat: "relationship", a: "הודעות כל היום", b: "שיחה טובה בערב" },
  { key: "jealousy", cat: "relationship", a: "קצת קנאה זה רומנטי", b: "אמון מלא, בלי קנאה" },
  { key: "the_bill", cat: "relationship", a: "מתחלקים בחשבון", b: "מי שהזמין משלם" },
  { key: "love_lang", cat: "relationship", a: "מילים טובות", b: "מעשים קטנים" },
  { key: "arguments", cat: "relationship", a: "מדברים על זה מיד", b: "צריך זמן להירגע" },
  { key: "pace", cat: "relationship", a: "לאט ובטוח", b: "כשזה נכון — יודעים" },
  { key: "marriage", cat: "relationship", a: "חתונה בשנתיים הקרובות", b: "בלי לחץ של זמן" },
  { key: "cooking", cat: "lifestyle", a: "מבשלים בבית", b: "מזמינים בחוץ" },
  { key: "friends", cat: "lifestyle", a: "חבורה גדולה", b: "כמה חברים קרובים" },
  { key: "fitness", cat: "lifestyle", a: "ספורט כל יום", b: "ספורט כשבא לי" },
  { key: "travel", cat: "lifestyle", a: "טיול גדול בשנה", b: "הרבה סופ״שים קצרים" },
  { key: "dream_home", cat: "lifestyle", a: "דירה בעיר", b: "בית עם חצר" },
  { key: "phone", cat: "lifestyle", a: "תמיד זמין/ה", b: "יודע/ת לנתק" },
  { key: "night_out", cat: "lifestyle", a: "מסיבה עד הבוקר", b: "ערב שקט בבית" },
  { key: "screen", cat: "lifestyle", a: "ספר טוב", b: "סדרה טובה" },
  { key: "budget", cat: "lifestyle", a: "מתכננים תקציב", b: "מסתדרים איכשהו" },
  { key: "holidays", cat: "culture", a: "חגים עם כל המשפחה המורחבת", b: "חגים בבית קטן" },
  { key: "ethiopian_food", cat: "culture", a: "אוכל אתיופי כל שבוע", b: "פעם בכמה זמן" },
  { key: "home_music", cat: "culture", a: "מוזיקה אתיופית בבית", b: "מוזיקה ישראלית בבית" },
  { key: "kemis", cat: "culture", a: "קמיס בחגים ובשמחות", b: "בגדים מודרניים תמיד" },
  { key: "aliyah_story", cat: "culture", a: "חשוב לי להכיר את סיפור העלייה", b: "מסתכלים בעיקר קדימה" },
  { key: "home_language", cat: "culture", a: "אמהרית בבית", b: "עברית בבית" },
  { key: "parents_say", cat: "culture", a: "ההורים מעורבים בבחירה", b: "ההחלטה רק שלי" },
  { key: "sigd_where", cat: "culture", a: "סיגד בירושלים עם כולם", b: "סיגד בקהילה הקרובה" },
  { key: "buna_ritual", cat: "culture", a: "בונה כל שבת", b: "בונה רק באירועים" },
  { key: "wedding_style", cat: "culture", a: "חתונה מסורתית מלאה", b: "שילוב של מסורתי ומודרני" },
] as const;

export const ALL_QUESTIONS = [...QUIZ_QUESTIONS, ...BONUS_QUESTIONS];

export const QUESTION_CATEGORIES: Record<string, string> = {
  culture: "☕ מהבית",
  general: "✨ מהחיים",
  values: "🤍 ערכים",
  relationship: "💛 זוגיות",
  lifestyle: "🌿 סגנון חיים",
};

export const ICEBREAKERS = [
  "בטקס בונה — את/ה בצוות הפופקורן או בצוות הקטורת? ☕",
  "מה המאכל שאמא שלך מכינה שהיית לוקח/ת לאי בודד?",
  "טדי אפרו או אסתר רדא — מי מנצח בפלייליסט שלך?",
  "איך את/ה חוגג/ת סיגד — ירושלים עם כולם או בשקט?",
  "איזו מילה באמהרית לא אמורה להיות מתורגמת לעברית אף פעם?",
  "מה הדבר הכי ׳הבשתי׳ שעשית השבוע? 😄",
  "אם היינו נפגשים לבונה מחר — איפה בעיר?",
];

export const PLANS = {
  monthly_49: {
    id: "monthly_49",
    title: "חודשי",
    price: 49,
    priceLabel: "₪49",
    period: "לחודש",
    perMonth: 49,
    note: "ביטול בכל עת",
    months: 1,
  },
  quarterly_119: {
    id: "quarterly_119",
    title: "3 חודשים",
    price: 119,
    priceLabel: "₪119",
    period: "ל־3 חודשים",
    perMonth: 39.67,
    note: "חיסכון של 19%",
    months: 3,
    badge: "מומלץ למציאת אהבה",
  },
} as const;

export type PlanType = keyof typeof PLANS;
export const TRIAL_DAYS = 7;

export const LOCATIONS = [
  "תל אביב",
  "ירושלים",
  "חיפה",
  "ראשון לציון",
  "רחובות",
  "נתניה",
  "אשדוד",
  "באר שבע",
  "קריית גת",
  "פתח תקווה",
  "חדרה",
  "עפולה",
];
