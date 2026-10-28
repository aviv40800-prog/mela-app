import "server-only";
import { db } from "./db";
import { getUser, isProfileComplete } from "./users";
import { isAdmin } from "./admin";
import { mailMember } from "./member-mail";
import { signupStage } from "./signup-stage";
import { loadChat } from "./ai-onboarding";

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
      kind: "reminder",
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

const israelDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);
const israelHour = (d: Date) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", hourCycle: "h23" }).format(d));
/** The second email goes out from 21:00 (Israel time) on the day after signing up. */
const SECOND_HOUR = 21;

/** Due once the member's day after sign-up has reached 21:00 in Israel (and on any later day). */
export function secondReminderDue(createdAt: string, now = new Date()): boolean {
  const created = new Date(createdAt.replace(" ", "T") + "Z");
  const next = israelDay(new Date(created.getTime() + 86_400_000));
  const today = israelDay(now);
  return today > next || (today === next && israelHour(now) >= SECOND_HOUR);
}

/**
 * The second "finish your profile" email, to members who verified but still have no complete profile: those who
 * finished the sign-up chat without approving get "your profile is ready", everyone else "we kept your place".
 * Once per member. Members who were already stuck when this shipped get it on the first run.
 */
export function sendSecondReminders(now = new Date()): number {
  const rows = db
    .prepare(
      `SELECT id, created_at FROM users
       WHERE signup_reminder2_at IS NULL AND email_verified = 1 AND is_banned = 0 AND is_demo = 0 AND is_test = 0 AND email IS NOT NULL`,
    )
    .all() as { id: number; created_at: string }[];
  const mark = db.prepare("UPDATE users SET signup_reminder2_at = datetime('now') WHERE id = ?");
  let sent = 0;
  for (const { id, created_at } of rows) {
    const u = getUser(id);
    if (!u || isProfileComplete(u) || isAdmin(u) || !u.email) {
      mark.run(id); // nothing to remind — never look at them again
      continue;
    }
    if (!secondReminderDue(created_at, now)) continue;
    mark.run(id);
    const name = (u.full_name ?? loadChat(u.id).draft.full_name ?? "").split(/\s+/)[0];
    const hi = name ? `היי ${name},` : "היי,";
    const link = `/signup?email=${encodeURIComponent(u.email)}`;
    if (signupStage(u).stage === "unsaved") {
      mailMember(id, {
      kind: "reminder",
        subject: "הפרופיל שלך מוכן, נשאר רק לאשר 💛",
        lines: [hi, "סיימת את כל השאלות, והפרופיל שלך כבר מוכן. נשאר רק ללחוץ \"אישור\", ומאותו רגע יראו אותך.", "", "כרגע הפרופיל שלך עוד לא מופיע לאף אחד.", "", "MELA, השדכנית של העדה 🤎"],
        link,
        cta: "לאשר את הפרופיל שלי",
      });
    } else {
      mailMember(id, {
      kind: "reminder",
        subject: name ? `${name}, שמרנו לך את המקום 💛` : "שמרנו לך את המקום 💛",
        lines: [
          hi,
          "התחלת להירשם ל־MELA ועצרת באמצע. אין בעיה, הכול נשמר, ואפשר להמשיך בדיוק מאיפה שעצרת.",
          "",
          "כל יום מצטרפים ל־MELA עוד רווקים ורווקות מהקהילה. ברגע שהפרופיל שלך יושלם, נתחיל להציע לך התאמות.",
          "",
          "⏱ נשארו בערך 3 דקות",
          "✅ ההרשמה חינם",
          "",
          "MELA, השדכנית של העדה 🤎",
        ],
        link,
        cta: "להמשיך מאיפה שעצרתי",
      });
    }
    sent++;
  }
  return sent;
}
