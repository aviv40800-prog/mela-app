import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/guard";
import { canSetPassword, suggestUsername } from "@/lib/auth";
import { nextOnboardingStep } from "@/lib/onboarding";
import { isAdmin } from "@/lib/admin";
import { isProfileComplete } from "@/lib/users";
import { AccountSetup } from "@/components/AccountSetup";

/** Choose a username + password: after the sign-up code, after a "forgot password" code, or once for members from before passwords. */
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const user = await requirePageUser("verified");
  const { reset } = await searchParams;
  if (!canSetPassword(user.id)) redirect(isAdmin(user) ? "/admin" : nextOnboardingStep(user));
  // Sign-up now asks for this at the end, right after the profile is built; members from before passwords see it once.
  const isNew = Date.now() - new Date(user.created_at.replace(" ", "T") + "Z").getTime() < 3 * 86_400_000;
  const mode = reset ? "reset" : isNew || !isProfileComplete(user) ? "new" : "existing";
  return <AccountSetup mode={mode} currentUsername={user.username} suggested={user.username ?? suggestUsername(user.email)} />;
}
