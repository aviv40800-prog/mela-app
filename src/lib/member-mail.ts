import "server-only";
import { db } from "./db";
import { sendEmail } from "./email";
import { emailAllowed, type EmailKind } from "./email-budget";
import { SITE_URL } from "./site";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * A short email to a member (only to a verified address). Fire-and-forget: never blocks or fails the request
 * that triggered it, and stays quiet in tests.
 */
export function mailMember(userId: number, mail: { subject: string; lines: string[]; link: string; cta: string; kind?: EmailKind }): boolean {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return false;
  const kind = mail.kind ?? "other";
  if (!emailAllowed(kind)) {
    console.warn(`[member-mail] daily email budget reached — ${kind} email skipped`);
    return false;
  }
  const row = db.prepare("SELECT email FROM users WHERE id = ? AND email_verified = 1 AND is_banned = 0").get(userId) as { email: string | null } | undefined;
  if (!row?.email) return false;
  const url = SITE_URL + mail.link;
  const text = [...mail.lines, "", `${mail.cta}: ${url}`].join("\n");
  // The address again as plain text: the provider rewrites links through its click-tracking server, and when that
  // server fails the button leads nowhere. Plain text is left alone, and mail apps turn it into a direct link.
  const plain = url.replace(/^https?:\/\//, "");
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7">${mail.lines.map((l) => `<div>${esc(l)}</div>`).join("")}<p><a href="${url}" style="display:inline-block;background:#b8892b;color:#fff;padding:10px 22px;border-radius:999px;text-decoration:none;font-weight:bold">${esc(mail.cta)}</a></p><p style="font-size:13px;color:#777">אם הכפתור לא נפתח, אפשר להיכנס ישירות: <span dir="ltr">${esc(plain)}</span></p></div>`;
  sendEmail({ to: row.email, subject: mail.subject, text, html, kind }).catch((e) => console.error("[member-mail] failed", (e as Error).message));
  return true;
}
