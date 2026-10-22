import "server-only";
import { db } from "./db";
import { isProfileComplete, type User } from "./users";
import { aiOnboardingAvailable } from "./ai-onboarding";

/**
 * Where a signed-in member should land. Freemium: a complete profile is all it takes to use the app;
 * Premium is offered from upgrade prompts (out of likes, locked picks, who liked you) — not at sign-up.
 */
export function nextOnboardingStep(user: User): string {
  // New members go straight from the email code to a short chat with MELA's host (when AI is configured);
  // the form stays available.
  if (!isProfileComplete(user)) return aiOnboardingAvailable(user.id) ? "/onboarding/chat" : "/onboarding/profile";
  // Once the profile is ready: save it with a username + password, or "later" (signing in with an email code).
  if (!user.has_password && !accountSkipped(user.id)) return "/onboarding/account";
  return "/discover";
}

export function accountSkipped(userId: number): boolean {
  return !!(db.prepare("SELECT account_skipped_at FROM users WHERE id = ?").get(userId) as { account_skipped_at: string | null } | undefined)?.account_skipped_at;
}

export function skipAccountSetup(userId: number) {
  db.prepare("UPDATE users SET account_skipped_at = datetime('now') WHERE id = ?").run(userId);
}
