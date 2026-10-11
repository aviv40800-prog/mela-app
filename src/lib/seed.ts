import type { DatabaseSync } from "node:sqlite";
import { DEMO_PHOTOS } from "./demo-photos";

type DemoProfile = {
  name: string;
  age: number;
  gender: "male" | "female";
  location: string;
  occupation: string;
  bio: string;
  prompts: Record<string, string>;
  quiz: string; // 10 chars of a/b, one per QUIZ_QUESTIONS entry
};

const PROFILES: DemoProfile[] = [
  {
    name: "תגסט אלמו",
    age: 27,
    gender: "female",
    location: "תל אביב",
    occupation: "מהנדסת תוכנה",
    bio: "בונה מוצרים ביום, רוקדת אסקסטה בלילה. מחפשת מישהו שיודע להקשיב ולצחוק על עצמו.",
    prompts: {
      buna: "שלושה סבבים, פופקורן חם ושיחה שלא נגמרת עם אמא שלי.",
      eskista: "כל שיר של טדי אפרו. אין לי שליטה על הכתפיים.",
      first_date: "בונה בפלורנטין, הליכה לים ושיחה על החלומות שלנו.",
    },
    quiz: "aabbbabaab",
  },
  {
    name: "ליה מנגיסטו",
    age: 25,
    gender: "female",
    location: "רחובות",
    occupation: "סטודנטית לרפואה",
    bio: "בין תורנויות לספרים, אני תמיד מוצאת זמן לשבת של משפחה. ערכים קודם לכל.",
    prompts: {
      family_value: "הכבוד למבוגרים. סבא שלי עדיין המילה האחרונה בבית.",
      grandma_dish: "דורו וואט של סבתא בחג. אף מסעדה לא מתקרבת.",
      dealbreaker: "יודע מאיפה הוא בא ולאן הוא הולך.",
    },
    quiz: "aaaaaaaaba",
  },
  {
    name: "מזל טספאי",
    age: 29,
    gender: "female",
    location: "ירושלים",
    occupation: "עורכת דין",
    bio: "לוחמת צדק חברתי, מכורה לקפה ולטיולים. גאה בשורשים, חיה את העתיד.",
    prompts: {
      sigd: "על הטיילת בארמון הנציב, לבושה בלבן, עם כל המשפחה.",
      two_worlds: "מתרגמת לאמא שלי את הבירוקרטיה ולחברים שלי את הבדיחות של אבא.",
      amharic_word: "ፍቅር (פיקר) — אהבה. פשוט וחזק.",
    },
    quiz: "ababaaabab",
  },
  {
    name: "הדס ברהנו",
    age: 26,
    gender: "female",
    location: "חיפה",
    occupation: "מעצבת UX",
    bio: "רואה יופי בפרטים הקטנים. אוהבת אמנות, ים, ואנשים עם לב גדול.",
    prompts: {
      buna: "ג'בנה של סבתא, קטורת ושקט של בוקר שבת.",
      first_date: "תערוכה במוזיאון ואז אוכל אתיופי בשוק תלפיות.",
      dealbreaker: "לא מפחד להראות רגש.",
    },
    quiz: "babbbbbabb",
  },
  {
    name: "רחל וורקו",
    age: 30,
    gender: "female",
    location: "ראשון לציון",
    occupation: "מנהלת שיווק",
    bio: "יודעת מה אני רוצה ולא מתנצלת על זה. מחפשת שותף לחיים, לא עוד צ'אט.",
    prompts: {
      family_value: "להחזיק את המשפחה ביחד, גם כשקשה.",
      eskista: "תיזיתה — כל פעם מחדש.",
      two_worlds: "מרגישה בבית בשניהם, ובונה את הגשר בשביל הדור הבא.",
    },
    quiz: "aaaabaaaaa",
  },
  {
    name: "סבלה גטהון",
    age: 24,
    gender: "female",
    location: "נתניה",
    occupation: "מורה לאנגלית",
    bio: "אופטימית חסרת תקנה. קוראת, צוחקת, ולפעמים שרה ברכב בקול רם מדי.",
    prompts: {
      grandma_dish: "שירו עם אינג'רה טרייה. בית.",
      amharic_word: "ተስፋ (טספה) — תקווה.",
      first_date: "פיקניק בפארק עם פלייליסט משותף.",
    },
    quiz: "abaabbaaba",
  },
  {
    name: "תמר אייאלו",
    age: 28,
    gender: "female",
    location: "באר שבע",
    occupation: "אחות בסורוקה",
    bio: "אכפתית, מצחיקה ועם המון אנרגיה. משפחה, אמונה וטיולים בנגב.",
    prompts: {
      sigd: "מתפללת עם סבתא ואז אוכלים ביחד כל השכונה.",
      family_value: "הכנסת אורחים. אצלנו הדלת תמיד פתוחה.",
      dealbreaker: "חם לאנשים ויודע לבקש סליחה.",
    },
    quiz: "aaabaaaaab",
  },
  {
    name: "יונתן טקלה",
    age: 29,
    gender: "male",
    location: "תל אביב",
    occupation: "יזם בתחום הפינטק",
    bio: "בונה סטארט־אפ ומשפחה — בסדר הפוך. אוהב כדורסל, בישול ושיחות עמוקות.",
    prompts: {
      buna: "אני המכין הרשמי במשפחה. כן, גם את הפופקורן.",
      two_worlds: "חי בהייטק, נושם את הבית. לוקח את הטוב משניהם.",
      first_date: "ארוחה שאני מבשל לך. תני לי הזדמנות להרשים.",
    },
    quiz: "aaabbaaaaa",
  },
  {
    name: "דוד אברה",
    age: 31,
    gender: "male",
    location: "ירושלים",
    occupation: "רופא",
    bio: "רגוע, מסור, עם הומור יבש. מחפש מישהי שתהיה לי בית.",
    prompts: {
      family_value: "אבא שלי עבד בשתי עבודות כדי שאלמד. אני חייב לו הכול.",
      sigd: "בתפילה בארמון הנציב, ואז ארוחה גדולה אצל ההורים.",
      dealbreaker: "שיודעת לצחוק גם ביום רע.",
    },
    quiz: "aaaaaaaaaa",
  },
  {
    name: "אבי מלקו",
    age: 27,
    gender: "male",
    location: "חיפה",
    occupation: "אדריכל",
    bio: "מתכנן בניינים ומשאיר מקום לספונטניות. ים, אופניים ומוזיקה טובה.",
    prompts: {
      eskista: "אבבה טסלה — מעיף לי את הראש.",
      amharic_word: "ሰላም (סלאם) — שלום פנימי.",
      first_date: "שקיעה בבת גלים ואז בונה בהדר.",
    },
    quiz: "babbbabbbb",
  },
  {
    name: "ששון ביאדגלין",
    age: 26,
    gender: "male",
    location: "רחובות",
    occupation: "מדען נתונים",
    bio: "חנון גאה, רקדן מפתיע. מחפש מישהי סקרנית ואמיתית.",
    prompts: {
      grandma_dish: "קיטפו של אמא. אל תספרו לסבתא.",
      two_worlds: "מדבר אמהרית עם סבא ו־Python עם המחשב.",
      buna: "המון קטורת ושיחה על פוליטיקה עד שמישהו נעלב.",
    },
    quiz: "ababbabbab",
  },
  {
    name: "עמנואל גבאיהו",
    age: 30,
    gender: "male",
    location: "ראשון לציון",
    occupation: "קצין ביחידה טכנולוגית",
    bio: "אמין, ישיר ואוהב משפחה. בסופ״ש תמצאו אותי בטיול או על המנגל.",
    prompts: {
      family_value: "לעמוד מאחורי המילה שלך.",
      sigd: "ירושלים, עם כל החבר'ה מהשכונה.",
      dealbreaker: "שאפתנית עם לב חם.",
    },
    quiz: "aaaabaaaaa",
  },
  {
    name: "נתנאל אדמסו",
    age: 25,
    gender: "male",
    location: "נתניה",
    occupation: "מוזיקאי ומפיק",
    bio: "יוצר ביטים שמחברים את אדיס לתל אביב. הלב שלי ברחבה.",
    prompts: {
      eskista: "כל מה שאני מפיק. סליחה, לא סליחה.",
      amharic_word: "ደስታ (דסטה) — שמחה.",
      first_date: "הופעה קטנה, ואז אוכל רחוב בשתיים בלילה.",
    },
    quiz: "aabbbabbbb",
  },
  {
    name: "גדעון וונדימו",
    age: 32,
    gender: "male",
    location: "באר שבע",
    occupation: "מנהל בית ספר",
    bio: "מחנך בנשמה. מאמין בקהילה, בחינוך ובאהבה שנבנית לאט.",
    prompts: {
      family_value: "חינוך. סבתא שלי לא ידעה לקרוא ודאגה שכולנו נלמד.",
      buna: "שלושה סבבים — אבול, טונה, ברכה. אין קיצורי דרך.",
      dealbreaker: "שמאמינה שאפשר לשנות את העולם, צעד אחד בכל פעם.",
    },
    quiz: "aaaaaaaaaa",
  },
];

const QUIZ_KEYS = ["bread", "coffee", "music", "wedding", "shabbat", "city", "dance", "trip", "dinner", "plans"];

export function seedDemoData(db: DatabaseSync) {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM users WHERE is_demo = 1").get() as { n: number };
  if (n > 0) return;

  const insertUser = db.prepare(
    `INSERT INTO users (email, phone_number, full_name, age, gender, seeking, location, bio, occupation, photos, is_verified, is_demo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
  );
  const insertPrompt = db.prepare("INSERT INTO cultural_prompts (user_id, question_key, answer_text) VALUES (?, ?, ?)");
  const insertQuiz = db.prepare("INSERT INTO quiz_answers (user_id, question_key, choice) VALUES (?, ?, ?)");
  const insertSub = db.prepare(
    `INSERT INTO subscriptions (user_id, plan_type, status, current_period_end) VALUES (?, 'quarterly_119', 'active', datetime('now', '+90 days'))`,
  );

  db.exec("BEGIN");
  PROFILES.forEach((p, i) => {
    const phone = `+97250000${String(1000 + i)}`;
    const photos = DEMO_PHOTOS[p.gender][i % DEMO_PHOTOS[p.gender].length] ?? [];
    const { lastInsertRowid } = insertUser.run(
      `demo${i}@mela.app`,
      phone,
      p.name,
      p.age,
      p.gender,
      p.gender === "male" ? "female" : "male",
      p.location,
      p.bio,
      p.occupation,
      JSON.stringify(photos),
    );
    const id = Number(lastInsertRowid);
    for (const [key, answer] of Object.entries(p.prompts)) insertPrompt.run(id, key, answer);
    QUIZ_KEYS.forEach((key, q) => insertQuiz.run(id, key, p.quiz[q]));
    insertSub.run(id);
  });
  db.exec("COMMIT");
}
