import "server-only";
import { isProfileComplete, type User } from "./users";

/**
 * Where a signed-in member should land. Freemium: a complete profile is all it takes to use the app;
 * Premium is offered from upgrade prompts (out of likes, locked picks, who liked you) — not at sign-up.
 */
export function nextOnboardingStep(user: User): string {
  if (!isProfileComplete(user)) return "/onboarding/profile";
  return "/discover";
}
