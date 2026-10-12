import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/guard";
import { getSubscription, hasAccess, isMockBilling } from "@/lib/billing";
import { PLANS, type PlanType } from "@/lib/content";
import { OnboardingProgress } from "@/components/ui/OnboardingProgress";
import { CheckoutForm } from "@/components/CheckoutForm";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ plan?: string; welcome?: string }> }) {
  const user = await requirePageUser("profile");
  const sub = getSubscription(user.id);
  if (hasAccess(sub)) redirect("/profile");
  const { plan, welcome } = await searchParams;
  if (!plan || !(plan in PLANS)) redirect("/onboarding/plan");
  return (
    <div className="flex flex-1 flex-col">
      {welcome && <OnboardingProgress step={9} label="תשלום" />}
      <CheckoutForm plan={plan as PlanType} trial={!sub} demo={isMockBilling()} holderDefault={user.full_name ?? ""} />
    </div>
  );
}
