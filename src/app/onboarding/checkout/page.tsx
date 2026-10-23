import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/guard";
import { getSubscription, hasAccess, isMockBilling } from "@/lib/billing";
import { PLANS, trialEnabled, type PlanType } from "@/lib/content";
import { OnboardingProgress } from "@/components/ui/OnboardingProgress";
import { CheckoutForm } from "@/components/CheckoutForm";
import { TranzilaCheckout } from "@/components/TranzilaCheckout";
import { isTranzilaBilling } from "@/lib/payments";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ plan?: string; welcome?: string }> }) {
  const user = await requirePageUser("profile");
  const sub = getSubscription(user.id);
  if (hasAccess(sub)) redirect("/profile");
  const { plan, welcome } = await searchParams;
  if (!plan || !(plan in PLANS)) redirect("/onboarding/plan");
  return (
    <div className="flex flex-1 flex-col">
      {welcome && <OnboardingProgress step={9} label="תשלום" />}
      {isTranzilaBilling() ? (
        <TranzilaCheckout plan={plan as PlanType} trial={trialEnabled() && !sub} />
      ) : (
        <CheckoutForm plan={plan as PlanType} trial={trialEnabled() && !sub} demo={isMockBilling()} holderDefault={user.full_name ?? ""} />
      )}
    </div>
  );
}
