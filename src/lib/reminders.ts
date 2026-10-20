import "server-only";
import { db } from "./db";
import { getUser, isProfileComplete } from "./users";
import { isAdmin } from "./admin";
import { mailMember } from "./member-mail";

/** Members who verified their email this long ago and still have no complete profile get one reminder. */
const AFTER = "-1 hour";
const WITHIN = "-2 days";

/**
 * One gentle "you're a few minutes away" email to members who verified but stopped before finishing their
 * profile — once per member, only to a verified address. Returns how many were sent.
 */
export function sendSignupReminders(): number {
  const rows = db
    .prepare(
      `SELECT id FROM users
       WHERE signup_reminder_at IS NULL AND email_verified = 1 AND is_banned = 0 AND is_demo = 0
         AND created_at <= datetime('now', '${AFTER}') AND created_at >= datetime('now', '${WITHIN}')`,
    )
    .all() as { id: number }[];
  const mark = db.prepare("UPDATE users SET signup_reminder_at = datetime('now') WHERE id = ?");
  let sent = 0;
  for (const { id } of rows) {
    const u = getUser(id);
    if (!u || isProfileComplete(u) || isAdmin(u) || !u.email) {
      mark.run(id); // nothing to remind — never look at them again
      continue;
    }
    mark.run(id);
    mailMember(id, {
      subject: "נשארו לך רק כמה דקות 💛",
      lines: [
        "היי, כאן MELA 🤎",
        "ראיתי שהתחלת להירשם. נשארו רק כמה שאלות כדי שאוכל להתחיל לחפש עבורך.",
        "",
        "✅ ההרשמה חינם לגמרי",
        "⏳ ההתאמות הראשונות יוצאות ממש בקרוב, לקראת ההשקה ביום הסיגד (9/11).",
      ],
      link: `/signup?email=${encodeURIComponent(u.email)}`,
      cta: "להשלמת הפרופיל",
    });
    sent++;
  }
  return sent;
}
