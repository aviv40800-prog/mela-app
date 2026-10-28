import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/guard";
import { getSubscription, hasAccess } from "@/lib/billing";
import { FREE_DAILY_LIKES } from "@/lib/quota";
import { trialEnabled } from "@/lib/content";
import { OnboardingProgress } from "@/components/ui/OnboardingProgress";
import { PlanPicker } from "@/components/PlanPicker";
import { recordPlanView } from "@/lib/plan-views";

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ welcome?: string; from?: string }> }) {
  const user = await requirePageUser("profile");
  const sub = getSubscription(user.id);
  if (hasAccess(sub)) redirect("/profile");
  const params = await searchParams;
  const welcome = !!params.welcome;
  const fromNav = params.from === "nav";
  if (fromNav) recordPlanView(user.id, "nav");
  return (
    <div className="flex flex-1 flex-col">
      {welcome && <OnboardingProgress step={9} label="בחירת מסלול" />}
      <PlanPicker firstName={(user.full_name ?? "").split(" ")[0]} returning={!!sub || !trialEnabled()} welcome={welcome} freeLikes={FREE_DAILY_LIKES} fromNav={fromNav} />
    </div>
  );
}
