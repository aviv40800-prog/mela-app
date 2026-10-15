import { z } from "zod";
import { handle, json, error } from "@/lib/api";
import { loginWithPassword } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { nextOnboardingStep } from "@/lib/onboarding";
import { isAdmin } from "@/lib/admin";
import { SITE } from "@/lib/site";

const Body = z.object({ identifier: z.string().trim().min(1).max(200), password: z.string().min(1).max(200) });

// Password guessing across many accounts from one address: at most IP_MAX attempts per window.
const IP_MAX = 30;
const IP_WINDOW_MS = 15 * 60 * 1000;
const hits = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < IP_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10_000) hits.clear();
  return recent.length > IP_MAX;
}

export const POST = handle(async (req: Request) => {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("נא למלא שם משתמש (או אימייל) וסיסמה");
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  if (tooMany(ip)) return error("יותר מדי ניסיונות. נסו שוב בעוד רבע שעה.", 429);

  const r = loginWithPassword(parsed.data.identifier, parsed.data.password);
  if (!r.ok) {
    if (r.reason === "no_password") return error("עוד לא הגדרת סיסמה לחשבון הזה. נשלח לך קוד חד־פעמי למייל כדי ליצור אחת.", 400, { code: "no_password" });
    if (r.reason === "locked") return error(`יותר מדי ניסיונות שגויים. החשבון נעול ל־${r.minutes} דקות, או אפשר לאפס סיסמה.`, 429, { code: "locked" });
    if (r.reason === "banned") return error(`החשבון הושעה. לפרטים: ${SITE.email}`, 403);
    return error("שם המשתמש או הסיסמה לא נכונים", 400, { code: "invalid" });
  }
  await createSession(r.user.id);
  return json({ ok: true, next: isAdmin(r.user) ? "/admin" : nextOnboardingStep(r.user) });
});
