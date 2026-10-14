import "server-only";

/**
 * Transactional email (sign-in codes). Providers, chosen by EMAIL_PROVIDER:
 *  - "gmail"   — a Gmail account + App Password over SMTP (free, ~500/day): GMAIL_USER, GMAIL_APP_PASSWORD
 *  - "smtp"    — any SMTP server: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 *  - "resend"  — Resend HTTP API (free 3,000/month, needs your own domain): RESEND_API_KEY
 *  - "console" — log only (development / demo; the code is shown on screen)
 * EMAIL_FROM sets the sender, e.g. `MELA <datemela1@gmail.com>`.
 */
export const emailProvider = () => (process.env.EMAIL_PROVIDER ?? "console").toLowerCase();

type Mail = { to: string; subject: string; html: string; text: string };

export async function sendEmail(mail: Mail): Promise<void> {
  const provider = emailProvider();
  const from = process.env.EMAIL_FROM || (process.env.GMAIL_USER ? `MELA <${process.env.GMAIL_USER}>` : "MELA <no-reply@mela.app>");

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
      auth: {
        user: gmail ? process.env.GMAIL_USER : process.env.SMTP_USER,
        // Google shows App Passwords with spaces ("abcd efgh ijkl mnop"); they work either way.
        pass: (gmail ? process.env.GMAIL_APP_PASSWORD : process.env.SMTP_PASS)?.replace(/\s+/g, ""),
      },
    });
    await transport.sendMail({ from, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text });
    return;
  }

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
      <div style="font-size:15px;color:#6b5848;margin-top:8px">הקלד/י את הקוד באפליקציה כדי להמשיך</div>
    </td></tr>
    <tr><td align="center" style="padding:22px 28px">
      <div dir="ltr" style="display:inline-block;background:#ffffff;border:2px solid #d4b35f;border-radius:16px;padding:16px 26px;font-family:'Courier New',monospace;font-size:34px;font-weight:bold;letter-spacing:4px;color:#2a1c12">${digits}</div>
    </td></tr>
    <tr><td align="center" style="padding:0 28px 32px;font-size:13px;line-height:1.6;color:#8f735f">
      הקוד תקף ל־5 דקות.<br>אם לא ביקשת קוד, אפשר פשוט להתעלם מהמייל הזה.
    </td></tr>
  </table>
  <div style="font-size:12px;color:#a3917c;margin-top:16px">MELA · אפליקציית ההיכרויות של הקהילה</div>
</td></tr></table></body></html>`,
  };
}
