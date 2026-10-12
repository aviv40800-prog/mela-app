import { requirePageUser } from "@/lib/guard";
import { getSubscription, hasAccess } from "@/lib/billing";
import { redirect } from "next/navigation";
import { OnboardingProgress } from "@/components/ui/OnboardingProgress";
import { PlanPicker } from "@/components/PlanPicker";

export default async function PlanPage() {
  const user = await requirePageUser("profile");
  const sub = getSubscription(user.id);
  if (hasAccess(sub)) redirect("/discover");
  return (
    <div className="flex flex-1 flex-col">
      <OnboardingProgress step={7} label="בחירת מסלול" />
      <PlanPicker firstName={(user.full_name ?? "").split(" ")[0]} returning={!!sub} />
    </div>
  );
}
