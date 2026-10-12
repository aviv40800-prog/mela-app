import "server-only";
import { db } from "./db";
import { PLANS, TRIAL_DAYS, type PlanType } from "./content";

export type SubscriptionStatus = "trialing" | "active" | "canceled" | "past_due";
export type Subscription = {
  id: number;
  user_id: number;
  plan_type: PlanType;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string;
  payment_brand: string | null;
  payment_last4: string | null;
  payment_exp: string | null;
};

/** What the checkout keeps about a card. The full number and CVV never leave the browser. */
export type CardMeta = { brand: string; last4: string; exp: string };

export const isMockBilling = () => (process.env.BILLING_PROVIDER ?? "mock") === "mock";

export function getSubscription(userId: number): Subscription | null {
  return (db.prepare("SELECT * FROM subscriptions WHERE user_id = ?").get(userId) as Subscription | undefined) ?? null;
}

/** Whether the member can use paid features right now. */
export function hasAccess(sub: Subscription | null): boolean {
  if (!sub) return false;
  if (sub.status === "trialing" || sub.status === "active") return true;
  // Canceled subscriptions keep access until the end of the period that was already paid / trialed.
  return sub.status === "canceled" && new Date(sub.current_period_end + "Z") > new Date();
}

/**
 * Starts the 7‑day free trial. Nothing is charged today.
 *
 * Billing provider seam: with a real PSP you would create a customer + tokenised payment method here
 * (Stripe SetupIntent / Tranzila or Cardcom token), schedule the first charge for trial_ends_at, and
 * flip status to "active" / "past_due" from the provider's webhook.
 */
export function startTrial(userId: number, plan: PlanType, card?: CardMeta): Subscription {
  if (!(plan in PLANS)) throw new Error("unknown plan");
  const existing = getSubscription(userId);
  const saveCard = () =>
    card &&
    db.prepare("UPDATE subscriptions SET payment_brand = ?, payment_last4 = ?, payment_exp = ? WHERE user_id = ?").run(card.brand, card.last4, card.exp, userId);
  if (existing) {
    // One free trial per member: a returning member re-activates instead of starting a new trial.
    if (existing.status === "canceled") {
      db.prepare("UPDATE subscriptions SET plan_type = ? WHERE user_id = ?").run(plan, userId);
      resumeSubscription(userId);
    }
    saveCard();
    return getSubscription(userId)!;
  }
  db.prepare(
    `INSERT INTO subscriptions (user_id, plan_type, status, trial_ends_at, current_period_end, provider_ref)
     VALUES (?, ?, 'trialing', datetime('now', ?), datetime('now', ?), ?)`,
  ).run(userId, plan, `+${TRIAL_DAYS} days`, `+${TRIAL_DAYS} days`, `${process.env.BILLING_PROVIDER ?? "mock"}:${userId}`);
  saveCard();
  return getSubscription(userId)!;
}

export function cancelSubscription(userId: number) {
  db.prepare("UPDATE subscriptions SET status = 'canceled' WHERE user_id = ?").run(userId);
}

export function resumeSubscription(userId: number) {
  db.prepare(
    "UPDATE subscriptions SET status = CASE WHEN trial_ends_at > datetime('now') THEN 'trialing' ELSE 'active' END WHERE user_id = ? AND status = 'canceled'",
  ).run(userId);
}
