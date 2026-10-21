import "server-only";
import { db } from "./db";
import { sendEmail } from "./email";
import { SITE, SITE_URL } from "./site";

/**
 * Emails the team about new sign-ups and payments. Goes to MELA_NOTIFY_EMAIL (comma-separated; default: the site
 * email); MELA_NOTIFY_EMAIL=off turns it off. Never blocks or fails the member's request.
 */
const recipients = () => {
  const set = (process.env.MELA_NOTIFY_EMAIL ?? "").trim();
  if (set.toLowerCase() === "off") return [];
  return (set || SITE.email).split(",").map((e) => e.trim()).filter(Boolean);
};
const siteUrl = () => SITE_URL;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function notify(subject: string, lines: string[], link: string) {
  const to = recipients();
  if (!to.length || process.env.NODE_ENV === "test" || process.env.VITEST) return;
  const url = siteUrl() + link;
  const text = [...lines, "", url].join("\n");
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6">${lines.map((l) => `<div>${esc(l)}</div>`).join("")}<p><a href="${url}">לצפייה בפאנל הניהול</a></p></div>`;
  for (const addr of to) {
    sendEmail({ to: addr, subject, text, html }).catch((e) => console.error("[notify] failed", (e as Error).message));
  }
}

const memberCount = () => (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
const israelTime = () => new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "short", timeStyle: "short" });

/** A new member verified their email. */
export function notifyNewSignup(user: { id: number; email: string | null; phone_number?: string | null }) {
  notify(`🎉 נרשם/ה משתמש/ת חדש/ה ל-MELA`, [`נרשם/ה משתמש/ת חדש/ה: ${user.email ?? user.phone_number ?? `#${user.id}`}`, `זמן: ${israelTime()}`, `סה״כ רשומים: ${memberCount()}`], `/admin/users/${user.id}`);
}

/** Today's AI sign-up chats are close to (or at) the daily cap — after it, new members get the form instead. */
export function notifyAiLimit(p: { used: number; limit: number; full: boolean }) {
  notify(
    p.full ? "⚠️ MELA: המכסה היומית של שיחות ההרשמה עם AI נגמרה" : "MELA: שיחות ההרשמה עם AI מתקרבות למכסה היומית",
    [
      `היום התחילו ${p.used} שיחות הרשמה עם AI, מתוך מכסה של ${p.limit}.`,
      p.full ? "מעכשיו ועד חצות, נרשמים חדשים מקבלים את הטופס הרגיל במקום השיחה." : "כשהמכסה תתמלא, נרשמים חדשים יקבלו את הטופס הרגיל במקום השיחה.",
      "להגדלה: ב-Railway, במשתנה MELA_AI_DAILY_LIMIT (למשל 200).",
    ],
    "/admin",
  );
}

/** A checkout was paid (trial fee or a renewal). */
export function notifyPayment(p: { userId: number | null; email: string | null; plan: string; sum: number; trial: boolean }) {
  notify(`💳 תשלום חדש ב-MELA: ₪${p.sum}`, [`${p.trial ? "התחיל/ה תקופת ניסיון" : "חידוש מנוי"}: ${p.email ?? `#${p.userId}`}`, `מסלול: ${p.plan} · סכום: ₪${p.sum}`, `זמן: ${israelTime()}`], p.userId ? `/admin/users/${p.userId}` : "/admin/payments");
}
