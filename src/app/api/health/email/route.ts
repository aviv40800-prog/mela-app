import { emailFrom, emailMisconfigured, emailProvider, getLastEmailError, sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const tests: number[] = [];

/**
 * Which email provider is active and the last send error, if any — no keys are ever shown.
 * `?test=1` sends a test email to the sender's own inbox (EMAIL_FROM) and reports the provider's exact answer;
 * limited to 5 an hour, and it can't be pointed at anyone else.
 */
export async function GET(req: Request) {
  const provider = emailProvider();
  let test: { sentTo: string; ok: boolean; error?: string } | undefined;
  if (new URL(req.url).searchParams.get("test") === "1") {
    const now = Date.now();
    while (tests.length && now - tests[0] > 3_600_000) tests.shift();
    if (tests.length >= 5) return Response.json({ error: "יותר מדי בדיקות — נסו שוב בעוד שעה" }, { status: 429 });
    tests.push(now);
    const to = emailFrom().match(/<([^>]+)>/)?.[1] ?? emailFrom();
    try {
      await sendEmail({ to, subject: "MELA — בדיקת שליחת מיילים", text: "אם המייל הזה הגיע, שליחת קודי הכניסה עובדת.", html: "<p dir=\"rtl\">אם המייל הזה הגיע, שליחת קודי הכניסה עובדת. ✓</p>" });
      test = { sentTo: to, ok: true };
    } catch (e) {
      test = { sentTo: to, ok: false, error: String((e as Error).message ?? e).slice(0, 400) };
    }
  }
  return Response.json({
    provider,
    sending: provider !== "console",
    misconfigured: emailMisconfigured(),
    from: emailFrom(),
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER ?? null,
    keys: {
      BREVO_API_KEY: !!(process.env.BREVO_API_KEY || process.env.BREVO_KEY || process.env.SENDINBLUE_API_KEY),
      BREVO_KEY_TYPE: (() => {
        const k = (process.env.BREVO_API_KEY || process.env.BREVO_KEY || process.env.SENDINBLUE_API_KEY || "").trim();
        return !k ? null : k.startsWith("xkeysib-") ? "api key (correct)" : k.startsWith("xsmtpsib-") ? "SMTP key (wrong type)" : "unknown format";
      })(),
      RESEND_API_KEY: !!process.env.RESEND_API_KEY,
      GMAIL_APP_PASSWORD: !!process.env.GMAIL_APP_PASSWORD,
    },
    lastError: getLastEmailError(),
    ...(test ? { test } : {}),
  });
}
