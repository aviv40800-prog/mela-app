import { handle, json, error, requireUser } from "@/lib/api";
import { getUser, isProfileComplete } from "@/lib/users";
import { nextOnboardingStep, skipAccountSetup } from "@/lib/onboarding";

/** "Later" on the username + password screen: don't ask again; the member signs in with an email code. */
export const POST = handle(async () => {
  const user = await requireUser();
  if (!isProfileComplete(user)) return error("קודם מסיימים את הפרופיל");
  skipAccountSetup(user.id);
  return json({ ok: true, next: nextOnboardingStep(getUser(user.id)!) });
});
