import { z } from "zod";
import { handle, json, error } from "@/lib/api";
import { normalizeIsraeliPhone } from "@/lib/phone";
import { verifyOtp } from "@/lib/otp";
import { createVerifiedUser, getUserByPhone } from "@/lib/users";
import { createSession } from "@/lib/session";
import { nextOnboardingStep } from "@/lib/onboarding";
import { isAdmin } from "@/lib/admin";

const Body = z.object({ phone: z.string(), code: z.string().regex(/^\d{6}$/) });

const MESSAGES = { invalid: "הקוד שגוי", expired: "הקוד פג תוקף, נא לבקש קוד חדש", locked: "יותר מדי ניסיונות, נא לבקש קוד חדש" };

export const POST = handle(async (req: Request) => {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  const phone = parsed.success ? normalizeIsraeliPhone(parsed.data.phone) : null;
  if (!parsed.success || !phone) return error("קוד לא תקין");

  const result = verifyOtp(phone, parsed.data.code);
  if (result !== "ok") return error(MESSAGES[result], result === "locked" ? 429 : 400);

  const existing = getUserByPhone(phone);
  if (existing?.is_banned) return error("החשבון הושעה. לפרטים: support@mela.app", 403);
  const user = existing ?? createVerifiedUser(phone);
  await createSession(user.id);
  // Admins land straight on the dashboard — they don't need a dating profile to manage the platform.
  return json({ ok: true, isNew: !existing, next: isAdmin(user) ? "/admin" : nextOnboardingStep(user) });
});
