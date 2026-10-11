import "server-only";
import { db } from "./db";
import { getUser, getPrompts, type User } from "./users";
import { insertMessage, sendMessage, markRead } from "./chat";
import { publish } from "./events";

// Demo-mode behaviour so a fresh install feels alive. Disable with MELA_DEMO_MODE=off (do this in production).
const enabled = () => process.env.MELA_DEMO_MODE !== "off";

const OPENERS = [
  "התשובה שלך על {q} הצחיקה אותי 😄 ספר/י עוד!",
  "אוקיי, {q} — אנחנו חייבים לדבר על זה מעל בונה ☕",
  "וואו, לגבי {q}… בדיוק אותו דבר אצלי בבית.",
];

const REPLIES = [
  "חחח בדיוק! ומה איתך — צוות פופקורן או צוות קטורת? ☕",
  "אהבתי. אמא שלי הייתה אומרת שזה סימן טוב 😊",
  "סיפור מעולה. איפה גדלת?",
  "אני חייבת/חייב לשמוע את הפלייליסט שלך עכשיו 🎶",
  "נשמע כמו התחלה של דייט טוב. מתי את/ה פנוי/ה השבוע?",
];

/** When a member finishes their profile, a few compatible demo members "like" them (some with a comment). */
export function seedDemoLikes(user: User) {
  if (!enabled() || user.is_demo) return;
  const already = db.prepare("SELECT COUNT(*) AS n FROM matches WHERE user_2_id = ?").get(user.id) as { n: number };
  if (already.n > 0) return;
  const fans = db
    .prepare(
      `SELECT id FROM users WHERE is_demo = 1 AND (? = 'everyone' OR gender = ?) AND (seeking = 'everyone' OR seeking = ?)
       ORDER BY random() LIMIT 3`,
    )
    .all(user.seeking, user.seeking, user.gender) as { id: number }[];
  const myPrompts = getPrompts(user.id);
  fans.forEach((f, i) => {
    const { lastInsertRowid, changes } = db.prepare("INSERT OR IGNORE INTO matches (user_1_id, user_2_id, status) VALUES (?, ?, 'pending')").run(f.id, user.id);
    const prompt = myPrompts[i % Math.max(1, myPrompts.length)];
    if (i < 2 && prompt && Number(changes) > 0) {
      insertMessage(Number(lastInsertRowid), f.id, OPENERS[i % OPENERS.length].replace("{q}", `״${prompt.answer_text.slice(0, 40)}״`));
    }
  });
}

/** Demo members answer chat messages after a short, human-feeling delay. */
export function maybeDemoReply(matchId: number, demoUserId: number, humanId: number) {
  const demo = getUser(demoUserId);
  if (!enabled() || !demo?.is_demo) return;
  setTimeout(() => {
    markRead(matchId, demoUserId, humanId);
    publish(humanId, { type: "typing", matchId, userId: demoUserId });
    setTimeout(() => {
      sendMessage(matchId, demoUserId, humanId, REPLIES[Math.floor(Math.random() * REPLIES.length)]);
    }, 2200);
  }, 1200);
}
