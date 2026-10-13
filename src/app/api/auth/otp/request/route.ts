import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json, error } from "@/lib/api";
import { normalizeIsraeliPhone } from "@/lib/phone";
import { issueOtp } from "@/lib/otp";

const Body = z.object({ phone: z.string().min(9).max(20) });

// Guard against SMS pumping (someone requesting codes for many numbers to run up the SMS bill):
// at most IP_MAX codes per source address per window. In-memory — fine for a single instance.
const IP_MAX = Number(process.env.MELA_OTP_PER_IP) || 8;
const IP_WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, number[]>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < IP_WINDOW_MS);
  if (recent.length >= IP_MAX) return true;
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10_000) hits.clear();
  return false;
}

export const POST = handle(async (req: Request) => {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  const phone = parsed.success ? normalizeIsraeliPhone(parsed.data.phone) : null;
  if (!phone) return error("מספר נייד לא תקין");

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  if (tooMany(ip)) return error("יותר מדי בקשות. נסו שוב בעוד שעה.", 429);

  // Simple resend throttle: one code per 30 seconds per number.
  const row = db.prepare("SELECT expires_at FROM otp_codes WHERE phone_number = ?").get(phone) as { expires_at: number } | undefined;
  if (row && row.expires_at - 5 * 60 * 1000 > Date.now() - 30_000) return error("נא להמתין 30 שניות לפני שליחה חוזרת", 429);

  const { devCode } = await issueOtp(phone);
  return json({ ok: true, phone, devCode });
});
