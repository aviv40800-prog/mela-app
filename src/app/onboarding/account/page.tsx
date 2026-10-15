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
  // new members haven't built a profile yet; members from before passwords have one
  const mode = reset ? "reset" : isProfileComplete(user) ? "existing" : "new";
  return <AccountSetup mode={mode} currentUsername={user.username} suggested={user.username ?? suggestUsername(user.email)} />;
}
