import "server-only";
import { isProfileComplete, type User } from "./users";
import { getSubscription, hasAccess } from "./billing";

/** Where a signed-in member should land: profile setup → plan checkout → the app. */
export function nextOnboardingStep(user: User): string {
  if (!isProfileComplete(user)) return "/onboarding/profile";
  if (!hasAccess(getSubscription(user.id))) return "/onboarding/plan";
  return "/discover";
}
