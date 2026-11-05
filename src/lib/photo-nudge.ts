import "server-only";
import { db } from "./db";
import { mailMember } from "./member-mail";
import { getUser, isProfileComplete } from "./users";

/**
 * One-off: Thursday 5/11/2026 from 18:00 (Israel time), a short email to members whose profile is complete but has
 * no photo — profiles with a photo come first in everyone's Discover. Each member gets it once (photo_nudges); it
 * stops for the day when the daily email budget for reminders is used up, and never sends after that evening.
 */
const DAY = "2026-11-05";
const FROM_HOUR = 18;
const UNTIL_HOUR = 22;

const israelDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);
const israelHour = (d: Date) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", hourCycle: "h23" }).format(d));

export function photoNudgeRecipients(): number[] {
  const rows = db
    .prepare(
      `SELECT id FROM users WHERE is_demo = 0 AND is_test = 0 AND is_banned = 0 AND email_verified = 1 AND email IS NOT NULL
         AND (photos IS NULL OR photos = '[]') AND id NOT IN (SELECT user_id FROM photo_nudges)`,
    )
    .all() as { id: number }[];
  return rows.map((r) => r.id).filter((id) => {
    const u = getUser(id);
    return !!u && isProfileComplete(u);
  });
}

export function sendPhotoNudges(now = new Date()): number {
  if (israelDay(now) !== DAY || israelHour(now) < FROM_HOUR || israelHour(now) >= UNTIL_HOUR) return 0;
  let sent = 0;
  for (const id of photoNudgeRecipients()) {
    const first = (getUser(id)?.full_name ?? "").split(/\s+/)[0];
    const ok = mailMember(id, {
      subject: "📸 חמישי בערב, וכולם נכנסים ל־MELA",
      lines: [
        `היי${first ? ` ${first}` : ""},`,
        "חמישי בערב זה הזמן שהכי הרבה אנשים גוללים ב־MELA.",
        "רק שהפרופיל שלך עוד בלי תמונה, ופרופילים עם תמונה מופיעים ראשונים לכל מי שמחפש.",
        "",
        "תמונה אחת, ואתם בראש הרשימה הערב 💛",
        "",
        "טיפ: תמונה ברורה של הפנים, עם חיוך, עובדת הכי טוב 😊",
      ],
      cta: "להוספת תמונה",
      link: "/onboarding/profile?edit=1&step=photos",
      kind: "reminder",
    });
    if (!ok) break; // budget used up (or no address): try the rest on the next tick, still within the evening
    db.prepare("INSERT OR IGNORE INTO photo_nudges (user_id) VALUES (?)").run(id);
    sent++;
  }
  return sent;
}
