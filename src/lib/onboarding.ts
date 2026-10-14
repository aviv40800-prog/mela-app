import "server-only";
import { isProfileComplete, type User } from "./users";
import { aiOnboardingEnabled } from "./ai-onboarding";

/**
 * Where a signed-in member should land. Freemium: a complete profile is all it takes to use the app;
 * Premium is offered from upgrade prompts (out of likes, locked picks, who liked you) — not at sign-up.
 */
export function nextOnboardingStep(user: User): string {
  // New members get to know MELA's host in a short chat (when AI is configured); the form stays available.
  if (!isProfileComplete(user)) return aiOnboardingEnabled() ? "/onboarding/chat" : "/onboarding/profile";
  return "/discover";
}
