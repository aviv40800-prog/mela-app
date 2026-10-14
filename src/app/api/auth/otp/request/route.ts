import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json, error } from "@/lib/api";
import { normalizeIsraeliPhone } from "@/lib/phone";
import { issueOtp } from "@/lib/otp";
import { normalizeEmail } from "@/lib/users";

// New members sign in with an emailed code; `phone` stays for members who registered by SMS.
const Body = z.union([z.object({ email: z.email().max(200) }), z.object({ phone: z.string().min(9).max(20) })]);

// Guard against code pumping (someone requesting codes for many addresses/numbers):
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
  const raw = await req.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  const byEmail = parsed.success && "email" in parsed.data;
  const key = !parsed.success ? null : "email" in parsed.data ? normalizeEmail(parsed.data.email) : normalizeIsraeliPhone(parsed.data.phone);
  if (!key) return error(raw && typeof raw === "object" && "phone" in raw ? "מספר נייד לא תקין" : "כתובת אימייל לא תקינה");

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  if (tooMany(ip)) return error("יותר מדי בקשות. נסו שוב בעוד שעה.", 429);

  // Simple resend throttle: one code per 30 seconds per address.
  const row = db.prepare("SELECT expires_at FROM otp_codes WHERE phone_number = ?").get(key) as { expires_at: number } | undefined;
  if (row && row.expires_at - 5 * 60 * 1000 > Date.now() - 30_000) return error("נא להמתין 30 שניות לפני שליחה חוזרת", 429);

  try {
    const { devCode } = await issueOtp(key);
    return json({ ok: true, ...(byEmail ? { email: key } : { phone: key }), devCode });
  } catch (e) {
    console.error("[otp] send failed", e);
    return error(byEmail ? "לא הצלחנו לשלוח את המייל כרגע. נסו שוב בעוד דקה." : "לא הצלחנו לשלוח SMS כרגע. נסו שוב בעוד דקה.", 502);
  }
});
