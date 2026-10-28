import "server-only";
import { countEmail, type EmailKind } from "./email-budget";

/**
 * Transactional email (sign-in codes). Providers, chosen by EMAIL_PROVIDER:
 *  - "gmail"   — a Gmail account + App Password over SMTP (free, ~500/day): GMAIL_USER, GMAIL_APP_PASSWORD
 *  - "smtp"    — any SMTP server: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 *  - "brevo"   — Brevo HTTP API (free 300/day): BREVO_API_KEY (an "xkeysib-…" API key). The sender address must be
 *                verified in Brevo (Senders, domains & IPs → Senders).
 *  - "resend"  — Resend HTTP API (free 3,000/month, needs your own domain): RESEND_API_KEY
 *  - "console" — log only (development / demo; the code is shown on screen)
 * EMAIL_FROM sets the sender, e.g. `MELA <datemela1@gmail.com>`.
 * Without EMAIL_PROVIDER the provider is inferred from whichever key is set.
 */
const brevoKey = () => (process.env.BREVO_API_KEY || process.env.BREVO_KEY || process.env.SENDINBLUE_API_KEY || "").trim();

const hasCreds: Record<string, () => boolean> = {
  brevo: () => !!brevoKey(),
  resend: () => !!process.env.RESEND_API_KEY,
  gmail: () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
  smtp: () => !!process.env.SMTP_HOST,
};

/**
 * The provider that will actually send. EMAIL_PROVIDER is honoured when that provider has its credentials;
 * otherwise (e.g. EMAIL_PROVIDER=gmail left over but only a Brevo key set) the first provider that does is used.
 */
export function emailProvider(): string {
  const set = (process.env.EMAIL_PROVIDER ?? "").trim().toLowerCase().replace("sendinblue", "brevo");
  if (set === "console") return "console";
  if (set && hasCreds[set]?.()) return set;
  return Object.keys(hasCreds).find((p) => hasCreds[p]()) ?? "console";
}

/** In production an email has to really go out (unless codes are deliberately shown on screen). */
export const emailMisconfigured = () => emailProvider() === "console" && process.env.NODE_ENV === "production" && process.env.MELA_SHOW_OTP !== "1";

/** Last delivery failure (no secrets) — shown by /api/health/email so a misconfiguration is easy to spot. */
let lastEmailError: { at: string; provider: string; message: string } | null = null;
export const getLastEmailError = () => lastEmailError;

/** "MELA <a@b.com>" → { name: "MELA", email: "a@b.com" } */
function parseFrom(from: string): { name?: string; email: string } {
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].trim() || undefined, email: m[2].trim() } : { email: from.trim() };
}

const DEFAULT_FROM = () => (process.env.GMAIL_USER ? `MELA <${process.env.GMAIL_USER}>` : "MELA <datemela1@gmail.com>");

export function emailFrom(provider = emailProvider()): string {
  const set = process.env.EMAIL_FROM?.trim();
  // Resend's sandbox sender (onboarding@resend.dev) only works through Resend — every other provider rejects it.
  if (set && /@resend\.dev>?$/i.test(set) && provider !== "resend") return DEFAULT_FROM();
  return set || DEFAULT_FROM();
}

type Mail = { to: string; subject: string; html: string; text: string; kind?: EmailKind };

export async function sendEmail(mail: Mail): Promise<void> {
  const provider = emailProvider();
  // Log every attempt (address masked) so delivery problems are visible in the hosting logs.
  const masked = mail.to.replace(/^(.).*?(@.*)$/, "$1***$2");
  // The chosen provider first, then any other configured one as a backup (e.g. Gmail SMTP blocked by the host → Brevo).
  const chain = [provider, ...Object.keys(hasCreds).filter((p) => p !== provider && hasCreds[p]())];
  let lastErr: unknown;
  for (const p of chain) {
    try {
      const id = await deliver(p, mail);
      countEmail(mail.kind ?? "other");
      console.info(`[email] sent via ${p} to ${masked}${id ? ` (id ${id})` : ""}`);
      return;
    } catch (e) {
      lastErr = e;
      lastEmailError = { at: new Date().toISOString(), provider: p, message: String((e as Error).message ?? e).slice(0, 400) };
      console.error(`[email] FAILED via ${p} to ${masked}: ${lastEmailError.message}`);
    }
  }
  throw lastErr;
}

async function deliver(provider: string, mail: Mail): Promise<string | void> {
  const from = emailFrom(provider);
  if (provider === "console" && emailMisconfigured())
    throw new Error("no email provider configured — set BREVO_API_KEY (or GMAIL_USER + GMAIL_APP_PASSWORD) in the environment");

  if (provider === "brevo") {
    const key = brevoKey();
    if (!key) throw new Error("BREVO_API_KEY is not set");
    if (key.startsWith("xsmtpsib-")) throw new Error("this is a Brevo SMTP key — create an API key (xkeysib-…) under SMTP & API → API keys");
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ sender: parseFrom(from), to: [{ email: mail.to }], subject: mail.subject, htmlContent: mail.html, textContent: mail.text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`brevo ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
    return ((await res.json().catch(() => ({}))) as { messageId?: string }).messageId;
  }

  if (provider === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
    });
    if (!res.ok) throw new Error(`email send failed: ${res.status} ${await res.text().catch(() => "")}`);
    return;
  }

  if (provider === "gmail" || provider === "smtp") {
    const nodemailer = await import("nodemailer");
    const gmail = provider === "gmail";
    const transport = nodemailer.createTransport({
      host: gmail ? "smtp.gmail.com" : process.env.SMTP_HOST,
      port: gmail ? 465 : Number(process.env.SMTP_PORT) || 587,
      secure: gmail ? true : Number(process.env.SMTP_PORT) === 465,
      // Fail fast when the host blocks outbound SMTP, so the backup provider takes over within seconds.
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 15000,
      auth: {
        user: gmail ? process.env.GMAIL_USER : process.env.SMTP_USER,
        // Google shows App Passwords with spaces ("abcd efgh ijkl mnop"); they work either way.
        pass: (gmail ? process.env.GMAIL_APP_PASSWORD : process.env.SMTP_PASS)?.replace(/\s+/g, ""),
      },
    });
    const info = await transport.sendMail({ from, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text });
    return info.messageId;
  }

  if (provider !== "console") throw new Error(`unknown EMAIL_PROVIDER "${provider}" (use brevo, gmail, smtp or resend)`);
  console.info(`[email:console] to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
}

/** The sign-in code email — ivory & gold, RTL, readable in every mail client (inline styles, tables). */
export function codeEmail(code: string): { subject: string; html: string; text: string } {
  const digits = code.split("").join("&nbsp;");
  return {
    subject: `קוד הכניסה שלך ל־MELA: ${code}`,
    text: `קוד הכניסה שלך ל־MELA: ${code}\nהקוד תקף ל־5 דקות. אם לא ביקשת קוד, אפשר להתעלם מהמייל.\n\nMELA · אהבה עם שורשים`,
    html: `<!doctype html><html lang="he" dir="rtl"><body style="margin:0;background:#f3ece1;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3ece1;padding:32px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#faf6ef;border-radius:24px;border:1px solid #e3cf9a">
    <tr><td align="center" style="padding:36px 28px 8px">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:34px;font-weight:bold;letter-spacing:10px;color:#b8892b">MELA</div>
      <div style="font-size:14px;color:#94690f;margin-top:6px">אהבה עם שורשים</div>
    </td></tr>
    <tr><td align="center" style="padding:24px 28px 0;color:#2a1c12">
      <div style="font-size:20px;font-weight:bold">קוד הכניסה שלך</div>
      <div style="font-size:15px;color:#6b5848;margin-top:8px">הקלד/י את הקוד באתר כדי להמשיך</div>
    </td></tr>
    <tr><td align="center" style="padding:22px 28px">
      <div dir="ltr" style="display:inline-block;background:#ffffff;border:2px solid #d4b35f;border-radius:16px;padding:16px 26px;font-family:'Courier New',monospace;font-size:34px;font-weight:bold;letter-spacing:4px;color:#2a1c12">${digits}</div>
    </td></tr>
    <tr><td align="center" style="padding:0 28px 32px;font-size:13px;line-height:1.6;color:#8f735f">
      הקוד תקף ל־5 דקות.<br>אם לא ביקשת קוד, אפשר פשוט להתעלם מהמייל הזה.
    </td></tr>
  </table>
  <div style="font-size:12px;color:#a3917c;margin-top:16px">MELA · פלטפורמת ההיכרויות של הקהילה</div>
</td></tr></table></body></html>`,
  };
}
