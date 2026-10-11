import "server-only";
import { redirect } from "next/navigation";
import { getSessionUserId } from "./session";
import { getUser, type User } from "./users";
import { nextOnboardingStep } from "./onboarding";

/** For server pages: ensures a session and that the member has reached at least `stage`. */
export async function requirePageUser(stage: "verified" | "profile" | "member"): Promise<User> {
  const id = await getSessionUserId();
  const user = id ? getUser(id) : null;
  if (!user) redirect("/onboarding/phone");
  if (stage === "verified") return user;
  const next = nextOnboardingStep(user);
  if (next === "/onboarding/profile") redirect(next);
  if (stage === "member" && next === "/onboarding/plan") redirect(next);
  return user;
}
