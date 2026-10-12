import "server-only";
import { isProfileComplete, type User } from "./users";

/**
 * Where a signed-in member should land. Freemium: a complete profile is all it takes to use the app;
 * the plan page is offered once right after onboarding (by the wizard) and from upgrade prompts.
 */
export function nextOnboardingStep(user: User): string {
  if (!isProfileComplete(user)) return "/onboarding/profile";
  return "/discover";
}
