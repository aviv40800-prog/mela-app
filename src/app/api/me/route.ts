import { z } from "zod";
import { handle, json, error, requireUser } from "@/lib/api";
import { getPrompts, getUser, updateProfile } from "@/lib/users";
import { getSubscription } from "@/lib/billing";
import { ProfileSchema as Profile } from "@/lib/profile-schema";
import { seedDemoLikes } from "@/lib/demo";
import { nextOnboardingStep } from "@/lib/onboarding";

export const GET = handle(async () => {
  const user = await requireUser();
  return json({ user, prompts: getPrompts(user.id), subscription: getSubscription(user.id) });
});

export const PUT = handle(async (req: Request) => {
  const user = await requireUser();
  const parsed = Profile.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? "פרטים חסרים");
  try {
    updateProfile(user.id, parsed.data);
  } catch (e) {
    if (String(e).includes("UNIQUE constraint failed: users.email")) return error("האימייל הזה כבר בשימוש בחשבון אחר", 409);
    throw e;
  }
  const updated = getUser(user.id)!;
  seedDemoLikes(updated);
  return json({ ok: true, next: nextOnboardingStep(updated) });
});
