import "server-only";
import { isProfileComplete, type User } from "./users";
import { aiOnboardingAvailable } from "./ai-onboarding";

/**
 * Where a signed-in member should land. Freemium: a complete profile is all it takes to use the app;
 * Premium is offered from upgrade prompts (out of likes, locked picks, who liked you) — not at sign-up.
 */
export function nextOnboardingStep(user: User): string {
  // Everyone signs in with a username + password; members from before that set them once.
  if (!user.has_password) return "/onboarding/account";
  // New members get to know MELA's host in a short chat (when AI is configured); the form stays available.
  if (!isProfileComplete(user)) return aiOnboardingAvailable(user.id) ? "/onboarding/chat" : "/onboarding/profile";
  return "/discover";
}
