import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json, error } from "@/lib/api";
import { normalizeIsraeliPhone } from "@/lib/phone";
import { issueOtp } from "@/lib/otp";

const Body = z.object({ phone: z.string().min(9).max(20) });

export const POST = handle(async (req: Request) => {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  const phone = parsed.success ? normalizeIsraeliPhone(parsed.data.phone) : null;
  if (!phone) return error("מספר נייד לא תקין");

  // Simple resend throttle: one code per 30 seconds per number.
  const row = db.prepare("SELECT expires_at FROM otp_codes WHERE phone_number = ?").get(phone) as { expires_at: number } | undefined;
  if (row && row.expires_at - 5 * 60 * 1000 > Date.now() - 30_000) return error("נא להמתין 30 שניות לפני שליחה חוזרת", 429);

  const { devCode } = await issueOtp(phone);
  return json({ ok: true, phone, devCode });
});
