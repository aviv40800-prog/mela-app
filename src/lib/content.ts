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

export const QUIZ_QUESTIONS = [
  { key: "bread", a: "אינג'רה", b: "פיתה" },
  { key: "coffee", a: "בונה בג'בנה", b: "אספרסו כפול" },
  { key: "music", a: "טדי אפרו", b: "מזרחית ישראלית" },
  { key: "wedding", a: "חתונה של 800 איש", b: "חתונה אינטימית" },
  { key: "shabbat", a: "שישי אצל ההורים", b: "סופ״ש בצפון" },
  { key: "city", a: "תל אביב", b: "ירושלים" },
  { key: "dance", a: "אסקסטה עד הבוקר", b: "סלואו בפינה" },
  { key: "trip", a: "טיול שורשים לגונדר", b: "חופשה ביוון" },
  { key: "dinner", a: "דורו וואט", b: "שקשוקה" },
  { key: "plans", a: "מתכננים הכל", b: "זורמים" },
] as const;

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
