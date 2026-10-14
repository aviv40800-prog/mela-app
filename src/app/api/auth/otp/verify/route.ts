import { z } from "zod";
import { handle, json, error } from "@/lib/api";
import { normalizeIsraeliPhone } from "@/lib/phone";
import { verifyOtp } from "@/lib/otp";
import { createEmailUser, createVerifiedUser, getUserByEmail, getUserByPhone, getUser, markEmailVerified, normalizeEmail } from "@/lib/users";
import { createSession } from "@/lib/session";
import { nextOnboardingStep } from "@/lib/onboarding";
import { isAdmin } from "@/lib/admin";

const Code = z.string().regex(/^\d{6}$/);
const Body = z.union([z.object({ email: z.email().max(200), code: Code }), z.object({ phone: z.string(), code: Code })]);

const MESSAGES = { invalid: "הקוד שגוי", expired: "הקוד פג תוקף, נא לבקש קוד חדש", locked: "יותר מדי ניסיונות, נא לבקש קוד חדש" };

export const POST = handle(async (req: Request) => {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("קוד לא תקין");
  const email = "email" in parsed.data ? normalizeEmail(parsed.data.email) : null;
  const key = email ?? normalizeIsraeliPhone((parsed.data as { phone: string }).phone);
  if (!key) return error("קוד לא תקין");

  const result = verifyOtp(key, parsed.data.code);
  if (result !== "ok") return error(MESSAGES[result], result === "locked" ? 429 : 400);

  const existing = email ? getUserByEmail(email) : getUserByPhone(key);
  if (existing?.is_banned) return error("החשבון הושעה. לפרטים: support@mela.app", 403);
  let user = existing ?? (email ? createEmailUser(email) : createVerifiedUser(key));
  // A member who registered by phone and later added this email now signs in with it — mark it proven.
  if (email && existing && !existing.email_verified) {
    markEmailVerified(existing.id, email);
    user = getUser(existing.id)!;
  }
  await createSession(user.id);
  // Admins land straight on the dashboard — they don't need a dating profile to manage the platform.
  return json({ ok: true, isNew: !existing, next: isAdmin(user) ? "/admin" : nextOnboardingStep(user) });
});
