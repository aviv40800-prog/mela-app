import { emailFrom, emailProvider, getLastEmailError } from "@/lib/email";

export const dynamic = "force-dynamic";

/** Which email provider is active and the last send error, if any — no keys are ever shown. */
export function GET() {
  const provider = emailProvider();
  return Response.json({
    provider,
    sending: provider !== "console",
    from: emailFrom(),
    keys: {
      BREVO_API_KEY: !!(process.env.BREVO_API_KEY || process.env.BREVO_KEY || process.env.SENDINBLUE_API_KEY),
      RESEND_API_KEY: !!process.env.RESEND_API_KEY,
      GMAIL_APP_PASSWORD: !!process.env.GMAIL_APP_PASSWORD,
    },
    lastError: getLastEmailError(),
  });
}
