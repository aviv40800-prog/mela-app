import type { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { DEMO_PHOTOS } from "./demo-photos";
import { UPLOAD_DIR } from "./paths";

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


// Compact rows for the wider demo community: [name, age, gender, city, occupation, bio, {prompt: answer}, quiz]
type Row = [string, number, "male" | "female", string, string, string, Record<string, string>, string];
const MORE: Row[] = [
  ["אביגיל דמקה", 26, "female", "פתח תקווה", "רואת חשבון", "מסודרת בעבודה, ספונטנית בחופש. אוהבת ריצות בוקר ומוזיקה אתיופית ישנה.", { buna: "סבב שלישי, ברכה, וכל השכונה בסלון.", first_date: "קפה טוב והליכה בפארק הירקון." }, "aaabbaaaba"],
  ["שירה מסלה", 28, "female", "תל אביב", "מנהלת מוצר בהייטק", "חיה על הקו שבין רוטשילד לבית של אמא בקריית מלאכי. מחפשת שותף אמיתי.", { two_worlds: "בעבודה מדברת אנגלית, בבית אמהרית, ובלב — שתיהן.", dealbreaker: "שאפתן שיודע גם לנוח." }, "abbbbabaab"],
  ["רות ייגזאו", 31, "female", "ירושלים", "פסיכולוגית קלינית", "מקשיבה במקצוע ובנשמה. אוהבת ספרים, ירושלים בחורף ושבתות ארוכות.", { family_value: "סבתא לימדה אותי שכבוד מתחיל בהקשבה.", sigd: "בטיילת, עם סבתא ביד אחת וסידור ביד השנייה." }, "aaaaaaaaaa"],
  ["נעמה נגוסה", 24, "female", "ראשון לציון", "סטודנטית למשפטים", "חולמת להיות שופטת. בינתיים שופטת רק את הקפה בקפיטריה.", { amharic_word: "ጎበዝ (גובז) — חרוצה. ככה אבא קורא לי.", eskista: "כל חתונה. אני הראשונה על הרחבה." }, "abaabbaaba"],
  ["יעל וסה", 27, "female", "חיפה", "מהנדסת אזרחית", "בונה גשרים — גם בעבודה וגם בין אנשים. אוהבת ים, טיפוס ושיחות עמוקות.", { two_worlds: "גשר. זה גם המקצוע שלי וגם מי שאני.", first_date: "שקיעה בסטלה מאריס." }, "babbbbbabb"],
  ["עדי אבבה", 29, "female", "רחובות", "חוקרת במכון ויצמן", "מדענית עם לב רך. מחפשת מישהו סקרן שלא מפחד משאלות.", { grandma_dish: "אינג'רה של סבתא עם מיסר וואט. אין שני לזה.", dealbreaker: "שאוהב ללמוד דברים חדשים." }, "abababbaba"],
  ["מרים טקלה", 30, "female", "קריית גת", "מנהלת בית ספר יסודי", "מחנכת, אופה ואמא לכל ילדי השכונה. מחפשת שותף לבנות בית חם.", { family_value: "שולחן שישי פתוח לכולם.", buna: "קטורת, פופקורן, וסבתא מספרת על גונדר." }, "aaaaaaaaab"],
  ["אסתר מלקו", 25, "female", "נתניה", "דיילת אוויר", "ראיתי חצי עולם ועדיין הכי אוהבת לחזור הביתה. מחפשת בית.", { first_date: "פיקניק על החוף בנתניה, עם פלייליסט של אסתר רדא.", amharic_word: "ፍቅር (פיקר) — אהבה." }, "abbabbabbb"],
  ["טל ביאדגלין", 26, "female", "באר שבע", "פיזיותרפיסטית", "מרפאה גוף ונפש. אוהבת את המדבר, כושר ואנשים אופטימיים.", { sigd: "בבאר שבע עם כל המשפחה, ואז ארוחה ענקית.", dealbreaker: "חיובי, בריא ואוהב משפחה." }, "aaabaaaaab"],
  ["שושנה ברהנו", 32, "female", "אשדוד", "עורכת דין לדיני משפחה", "יודעת מה היא רוצה. ערכים, משפחה, ומישהו שמצחיק אותי.", { family_value: "לשמור על השפה — הילדים שלי ידברו אמהרית.", grandma_dish: "דאבו קולו בחגים." }, "aaaaaaaaaa"],
  ["הילה גבאיהו", 27, "female", "עפולה", "מורה למוזיקה", "מנגנת על קראר ופסנתר. החיים שלי הם פלייליסט אחד ארוך.", { eskista: "מחמוד אחמד. קלאסיקה.", buna: "שלושה סבבים ושירה ביחד בסוף." }, "aababbaaba"],
  ["ברכה אדמסו", 28, "female", "חדרה", "אחות בטיפול נמרץ", "חזקה בחוץ, רכה בפנים. אוהבת טבע, שקט ואנשים אמיתיים.", { dealbreaker: "שעומד מאחורי המילה שלו.", first_date: "טיול בנחל ואז בונה בטרמוס." }, "aaabaaabab"],
  ["מיכל טספאי", 23, "female", "תל אביב", "סטודנטית לעיצוב אופנה", "מעצבת שמשלבת טילת עם רחוב. מחפשת מישהו עם סטייל ולב.", { two_worlds: "קמיס מסורתי עם סניקרס. זה אני.", amharic_word: "ቆንጆ (קונג'ו) — יפה." }, "babbbbbbab"],
  ["יוסף אלמו", 30, "male", "פתח תקווה", "מהנדס חשמל", "שקט, יציב ומצחיק כשמכירים. אוהב כדורגל, טיולים ואוכל של אמא.", { grandma_dish: "שירו של אמא. אני מבקר כל שישי בשבילו.", dealbreaker: "שתהיה החברה הכי טובה שלי." }, "aaaaabaaaa"],
  ["אליאור דמקה", 27, "male", "תל אביב", "מפתח תוכנה", "כותב קוד ביום, מנגן גיטרה בלילה. מחפש מישהי לצחוק איתה על הכל.", { two_worlds: "אבא מספר על אתיופיה, אני מספר לו על ה־AI.", first_date: "הופעה קטנה בפלורנטין ואוכל רחוב." }, "abbbbabbab"],
  ["שמואל מסלה", 33, "male", "ירושלים", "רב קהילה ומחנך", "מאמין בקהילה, במסורת ובצחוק טוב. מחפש שותפה לחיים של משמעות.", { sigd: "מוביל את התפילה עם הקסים. רגע של גאווה.", family_value: "אמונה ונתינה." }, "aaaaaaaaaa"],
  ["אבישי נגוסה", 28, "male", "אשדוד", "שוטר", "שומר על אחרים ומחפש מישהי לשמור עליה. ים, כושר ומשפחה.", { dealbreaker: "שאכפת לה מאנשים.", buna: "אני אחראי על הפופקורן. תמיד." }, "aaabaaaaab"],
  ["רפאל וסה", 29, "male", "חיפה", "רופא שיניים", "מחייך למחייתי 😁. אוהב ים, טניס ומוזיקה טובה.", { first_date: "ארוחת דגים בעכו ושקיעה על החומה.", amharic_word: "ሳቅ (סאק) — צחוק." }, "babbbabbbb"],
  ["מתן אבבה", 26, "male", "ראשון לציון", "יזם בתחום האוכל", "פתחתי מסעדה אתיופית־ישראלית קטנה. אם תבואי — הקינוח עליי.", { grandma_dish: "טיבס של סבתא. זה הבסיס לכל התפריט שלי.", eskista: "טדי אפרו. כל השירים." }, "aabbbaaaba"],
  ["בנימין ייגזאו", 31, "male", "רחובות", "חוקר בביוטכנולוגיה", "חנון של מדע ושל משפחה. מחפש מישהי חכמה עם לב גדול.", { family_value: "השכלה. ההורים שלי הקריבו הכל בשבילה.", two_worlds: "מעבדה ביום, בונה בערב." }, "abaaababaa"],
  ["אורי טקלה", 25, "male", "באר שבע", "סטודנט להנדסה", "שאפתן, ספורטאי ומשפחתי. החלום: לבנות בית ולטייל בעולם.", { first_date: "ג'יפים במדבר ומדורה.", dealbreaker: "שתאמין בי ואני בה." }, "aaabbaaaab"],
  ["יאיר מלקו", 32, "male", "נתניה", "מנהל סניף בנק", "אחראי ביום, צחקן בערב. מחפש קשר רציני עם מישהי חיובית.", { buna: "בבית של סבא, עם כל הדודים והסיפורים.", family_value: "לעזור תמיד, בלי לשאול למה." }, "aaaaaaabaa"],
  ["עידו ביאדגלין", 29, "male", "קריית גת", "מאמן כדורסל", "מאמן ילדים ומאמין בהם. מחפש מישהי שתהיה לי שותפה לקבוצה הכי חשובה.", { sigd: "עם כל הקבוצה שלי בירושלים.", eskista: "אסקסטה על המגרש אחרי ניצחון." }, "aaababaaab"],
  ["אליה גטהון", 27, "male", "עפולה", "צלם", "רואה את העולם דרך עדשה. אשמח לצלם אותך בשקיעה 📸", { two_worlds: "מצלם חתונות אתיופיות ותל אביביות — אותה שמחה.", first_date: "זריחה בגלבוע ואז ארוחת בוקר." }, "babbbbbbbb"],
  ["נתן ברהנו", 30, "male", "חדרה", "מהנדס בנייה", "בונה בניינים ומשפחה — בתקווה. אוהב ים, מנגל ושבתות.", { grandma_dish: "קיטפו בחג. בלי פשרות.", dealbreaker: "חמה, ישירה, ואוהבת לצחוק." }, "aaaabaaaaa"],
  ["טל אדמסו", 24, "male", "תל אביב", "רקדן ויוצר תוכן", "מחבר אסקסטה להיפ־הופ. אם תרקדי איתי — ניצחת.", { eskista: "כל ביט שאני שומע.", amharic_word: "ደስታ (דסטה) — שמחה." }, "abbbbabbbb"],
  ["דניאל טספאי", 34, "male", "ירושלים", "עורך דין", "רציני כשצריך, משוגע כשאפשר. מחפש את האחת — בלי משחקים.", { family_value: "אבא שלי עלה ברגל. אני לא מוותר על כלום.", sigd: "תמיד בארמון הנציב, משחר." }, "aaaaaaaaba"],
];

const WIDER: DemoProfile[] = MORE.map(([name, age, gender, location, occupation, bio, prompts, quiz]) => ({ name, age, gender, location, occupation, bio, prompts, quiz }));
const ALL_PROFILES = [...PROFILES, ...WIDER];

const QUIZ_KEYS = ["bread", "coffee", "music", "wedding", "shabbat", "city", "dance", "trip", "dinner", "plans"];

/**
 * Inserts any demo members that are missing (idempotent by phone number), so existing databases pick up
 * new demo members on the next start. Then assigns photos from ./seed-photos to demo members without any.
 */
export function seedDemoData(db: DatabaseSync) {
  const exists = db.prepare("SELECT 1 FROM users WHERE phone_number = ?");

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
  ALL_PROFILES.forEach((p, i) => {
    const phone = `+97250000${String(1000 + i)}`;
    if (exists.get(phone)) return;
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
  assignSeedPhotos(db);
}

const IMAGE = /\.(jpe?g|png|webp)$/i;

/**
 * Photos dropped in seed-photos/female and seed-photos/male are copied into the uploads store and given,
 * in file-name order, to demo members of that gender who have no photos yet (one photo each; extra photos
 * wrap around as additional photos). Only use images you hold the rights to.
 */
function assignSeedPhotos(db: DatabaseSync) {
  const root = process.env.MELA_SEED_PHOTOS_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), "seed-photos");
  for (const gender of ["female", "male"] as const) {
    const dir = path.join(/* turbopackIgnore: true */ root, gender);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => IMAGE.test(f)).sort();
    if (!files.length) continue;
    const members = db.prepare("SELECT id FROM users WHERE is_demo = 1 AND gender = ? AND photos = '[]' ORDER BY id").all(gender) as { id: number }[];
    if (!members.length) continue;
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const perMember = Math.max(1, Math.floor(files.length / members.length));
    members.forEach((m, i) => {
      const photos: string[] = [];
      for (let k = 0; k < Math.min(perMember, 3); k++) {
        const idx = (i * perMember + k) % files.length;
        const file = files[idx];
        const ext = file.split(".").pop()!.toLowerCase().replace("jpeg", "jpg");
        // Index keeps names unique even when the original name has no ASCII characters (e.g. Hebrew).
        const name = `seed-${gender}-${String(idx).padStart(3, "0")}-${path.basename(file, path.extname(file)).replace(/[^\w-]/g, "").slice(0, 40)}.${ext}`;
        const target = path.join(/* turbopackIgnore: true */ UPLOAD_DIR, name);
        if (!fs.existsSync(target)) fs.copyFileSync(path.join(/* turbopackIgnore: true */ dir, file), target);
        photos.push(`/api/photos/${name}`);
      }
      db.prepare("UPDATE users SET photos = ? WHERE id = ?").run(JSON.stringify(photos), m.id);
    });
  }
}
