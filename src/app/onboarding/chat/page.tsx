import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/guard";
import { isProfileComplete } from "@/lib/users";
import { aiOnboardingEnabled, getChat } from "@/lib/ai-onboarding";
import { OnboardingChat } from "@/components/OnboardingChat";

export const metadata = { title: "היכרות" };

export default async function ChatOnboardingPage() {
  const user = await requirePageUser("verified");
  if (!aiOnboardingEnabled()) redirect("/onboarding/profile");
  if (isProfileComplete(user)) redirect("/discover");
  return <OnboardingChat initial={getChat(user)} />;
}
