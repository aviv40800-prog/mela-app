import "server-only";
import { db } from "./db";
import { isAdmin } from "./admin";
import { mailMember } from "./member-mail";
import { getUser, isProfileComplete, type User } from "./users";

/**
 * One-off trial batch (9/11/2026): up to 50 emails, half to members whose profile is complete but has no photo, half
 * to members who started signing up and didn't finish (more from either side if the other runs short). Each member
 * once (profile_nudges). Members who signed up in the last day are left to the regular signup reminders.
 */
const DAY = "2026-11-09";
const LIMIT = 50;
const OPT_OUT = "לא רוצים לקבל מאיתנו מיילים? השיבו למייל הזה עם המילה “הסר”.";

const israelDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);

export function nudgeGroups(): { noPhoto: User[]; unfinished: User[] } {
  const rows = db
    .prepare(
      `SELECT id FROM users WHERE is_demo = 0 AND is_test = 0 AND is_banned = 0 AND email_verified = 1 AND email IS NOT NULL
         AND created_at <= datetime('now', '-1 day') AND id NOT IN (SELECT user_id FROM profile_nudges) ORDER BY id DESC`,
    )
    .all() as { id: number }[];
  const noPhoto: User[] = [];
  const unfinished: User[] = [];
  for (const { id } of rows) {
    const u = getUser(id);
    if (!u || isAdmin(u)) continue;
    if (!isProfileComplete(u)) unfinished.push(u);
    else if (u.photos.length === 0) noPhoto.push(u);
  }
  return { noPhoto, unfinished };
}

function send(u: User, kind: "no_photo" | "unfinished"): boolean {
  const first = (u.full_name ?? "").split(/\s+/)[0];
  const hi = `היי${first ? ` ${first}` : ""},`;
  const ok =
    kind === "no_photo"
      ? mailMember(u.id, {
          subject: "📸 חסרה רק תמונה אחת",
          lines: [
            hi,
            "הפרופיל שלך ב־MELA כמעט מושלם. חסרה רק תמונה.",
            "פרופילים עם תמונה מופיעים ראשונים לכל מי שמחפש, ומקבלים הרבה יותר לייקים.",
            "",
            "טיפ: תמונה ברורה של הפנים, עם חיוך, עובדת הכי טוב 😊",
            "",
            OPT_OUT,
          ],
          cta: "להוספת תמונה",
          link: "/onboarding/profile?edit=1&step=photos",
          kind: "reminder",
        })
      : mailMember(u.id, {
          subject: "💛 הפרופיל שלך מחכה לסיום",
          lines: [
            hi,
            "התחלת להירשם ל־MELA, ונשארו רק כמה דקות כדי לסיים.",
            "רק כשהפרופיל מלא, אחרים יכולים לראות אותך, ואפשר להתחיל לקבל לייקים והתאמות מהקהילה.",
            "",
            "ממשיכים בדיוק מאיפה שעצרת.",
            "",
            OPT_OUT,
          ],
          cta: "לסיום הפרופיל",
          link: `/signup?email=${encodeURIComponent(u.email ?? "")}`,
          kind: "reminder",
        });
  if (ok) db.prepare("INSERT OR IGNORE INTO profile_nudges (user_id, kind) VALUES (?, ?)").run(u.id, kind);
  return ok;
}

/** Runs on the server's tick; sends the batch once, only on its day. Returns how many were sent. */
export function sendNudgeBatch(now = new Date()): number {
  if (israelDay(now) !== DAY) return 0;
  const done = (db.prepare("SELECT COUNT(*) AS n FROM profile_nudges WHERE sent_at >= datetime('now', '-2 days')").get() as { n: number }).n;
  let room = LIMIT - done;
  if (room <= 0) return 0;
  const { noPhoto, unfinished } = nudgeGroups();
  const half = Math.ceil(room / 2);
  const a = noPhoto.slice(0, Math.max(half, room - unfinished.length));
  const b = unfinished.slice(0, room - a.length);
  let sent = 0;
  for (const [list, kind] of [
    [a, "no_photo"],
    [b, "unfinished"],
  ] as const) {
    for (const u of list) {
      if (room <= 0) break;
      if (!send(u, kind)) return sent; // daily budget reached: try again on the next tick
      sent++;
      room--;
    }
  }
  return sent;
}

export function nudgeResults() {
  return db
    .prepare(
      `SELECT n.kind, COUNT(*) AS sent,
         SUM(CASE WHEN n.kind = 'no_photo' THEN u.photos <> '[]' ELSE u.bio IS NOT NULL AND u.full_name IS NOT NULL END) AS acted
       FROM profile_nudges n JOIN users u ON u.id = n.user_id GROUP BY n.kind`,
    )
    .all() as { kind: string; sent: number; acted: number }[];
}
