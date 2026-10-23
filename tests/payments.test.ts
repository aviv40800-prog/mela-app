import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createVerifiedUser, updateProfile, getUser } from "@/lib/users";
import { accessUntil, createCheckout, getOrder, handleNotify, listProviderCancels, recentPaymentEvents } from "@/lib/payments";
import { cancelSubscription, getSubscription, hasAccess, resumeSubscription } from "@/lib/billing";
import { deleteOwnAccount } from "@/lib/safety";

process.env.TRANZILA_TERMINAL = "melatest";
process.env.TRANZILA_NOTIFY_KEY = "k".repeat(32);
const KEY = process.env.TRANZILA_NOTIFY_KEY;

let seq = 7000000;
function member() {
  const u = createVerifiedUser(`+97252${seq++}`);
  updateProfile(u.id, { full_name: "רות בדיקה", age: 27, gender: "female", seeking: "male", location: "חיפה", occupation: "x", bio: "ביו ארוכה מספיק כאן", photos: ["/api/photos/a.jpg"], prompts: [] });
  return getUser(u.id)!;
}
const paid = (orderId: string, sum: string, extra: Record<string, string> = {}) => ({ mela_order: orderId, Response: "000", sum, currency: "1", supplier: "melatest", TranzilaTK: "tok123", ccno: "4242", ...extra });

beforeEach(() => {
  db.exec("DELETE FROM users; DELETE FROM payment_orders; DELETE FROM payment_events; DELETE FROM provider_cancels;");
  process.env.MELA_TRIAL = "on"; // most of these cover the trial; the no-trial default has its own test below
});

describe("no trial (the default since Oct 2026)", () => {
  it("a first subscription is charged the full plan price today and opens an active subscription", () => {
    delete process.env.MELA_TRIAL;
    const u = member();
    const { fields, order } = createCheckout(u, "monthly_49");
    expect(fields).toMatchObject({ sum: "49.00", recur_sum: "49.00" });
    expect(order.trial).toBe(0);
    expect(fields.recur_start_date > new Date(Date.now() + 27 * 86_400_000).toISOString().slice(0, 10)).toBe(true); // next charge in a month
    expect(handleNotify(KEY, paid(order.id, "49.00"))).toEqual({ ok: true, note: "paid" });
    expect(getSubscription(u.id)?.status).toBe("active");
  });
});

describe("tranzila checkout", () => {
  it("a first subscription is ₪1 today and the plan price from day 7, monthly", () => {
    const u = member();
    const { fields, action } = createCheckout(u, "monthly_49");
    expect(action).toBe("https://directng.tranzila.com/melatest/iframenew.php");
    expect(fields).toMatchObject({ sum: "1.00", currency: "1", recur_sum: "49.00", recur_transaction: "4" });
    const in7 = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    expect(fields.recur_start_date).toBe(in7);
  });

  it("the quarterly plan recurs every 3 months at ₪119", () => {
    const { fields } = createCheckout(member(), "quarterly_119");
    expect(fields).toMatchObject({ recur_sum: "119.00", recur_transaction: "5" });
  });

  it("a paid notify opens the trial; a repeat of it changes nothing", () => {
    const u = member();
    const { order } = createCheckout(u, "monthly_49");
    expect(handleNotify(KEY, paid(order.id, "1.00"))).toEqual({ ok: true, note: "paid" });
    const sub = getSubscription(u.id)!;
    expect(sub.status).toBe("trialing");
    expect(sub.payment_last4).toBe("4242");
    expect(sub.current_period_end).toBe(`${order.recur_start} 00:00:00`);
    expect(hasAccess(sub)).toBe(true);
    expect(handleNotify(KEY, paid(order.id, "1.00")).note).toBe("already paid");
  });

  it("rejects forged or mismatched notifications", () => {
    const u = member();
    const { order } = createCheckout(u, "monthly_49");
    expect(handleNotify("wrong", paid(order.id, "1.00")).note).toBe("bad key");
    expect(handleNotify(null, paid(order.id, "1.00")).note).toBe("bad key");
    expect(handleNotify(KEY, paid("nope", "1.00")).note).toBe("unknown order");
    expect(handleNotify(KEY, paid(order.id, "0.10")).ok).toBe(false); // amount tampered in the browser
    expect(handleNotify(KEY, paid(order.id, "1.00", { supplier: "other" })).ok).toBe(false);
    expect(handleNotify(KEY, paid(order.id, "1.00", { currency: "2" })).ok).toBe(false);
    expect(getSubscription(u.id)).toBeNull();
    expect(handleNotify(KEY, paid(order.id, "1.00", { Response: "033" })).note).toMatch(/declined/);
    expect(getOrder(order.id)!.status).toBe("failed");
    const logged = db.prepare("SELECT COUNT(*) AS n FROM payment_events").get() as { n: number };
    expect(logged.n).toBe(7);
  });

  it("never stores a full card number or the full token from a notification", () => {
    const { order } = createCheckout(member(), "monthly_49");
    handleNotify(KEY, paid(order.id, "1.00", { ccno: "4580123412341234" }));
    const { payload } = db.prepare("SELECT payload FROM payment_events").get() as { payload: string };
    expect(payload).not.toContain("4580123412341234");
    expect(payload).not.toContain("tok123");
  });
});

describe("tranzila notify, as Tranzila really sends it", () => {
  it("reads the masked card number, accepts ILS, keeps the transaction number, hides the key and ID number", () => {
    const u = member();
    const { order } = createCheckout(u, "monthly_49");
    const r = handleNotify(KEY, paid(order.id, "1", { ccno: "547707******3257", currency: "ILS", index: "513306", myid: "123456789", notify_url: `https://x/api/tranzila/notify?key=${KEY}` }));
    expect(r.ok).toBe(true);
    expect(getSubscription(u.id)!.payment_last4).toBe("3257");
    expect(getOrder(order.id)!.confirmation).toBe("513306");
    const [e] = recentPaymentEvents(1);
    expect(e.payload).not.toContain(KEY);
    expect(e.payload).not.toContain("123456789");
    cancelSubscription(u.id);
    expect(listProviderCancels(false)[0].txn_ref).toBe("513306");
  });

  it("pins the notify to Tranzila's IPs once they are configured", () => {
    const { order } = createCheckout(member(), "monthly_49");
    process.env.TRANZILA_NOTIFY_IPS = "1.2.3.4, 5.6.7.8";
    try {
      expect(handleNotify(KEY, paid(order.id, "1.00"), "9.9.9.9").note).toMatch(/ip not allowed/);
      expect(handleNotify(KEY, paid(order.id, "1.00"), null).ok).toBe(false);
      expect(handleNotify(KEY, paid(order.id, "1.00"), "5.6.7.8").note).toBe("paid");
    } finally {
      delete process.env.TRANZILA_NOTIFY_IPS;
    }
  });
});

describe("tranzila cancel / resume / delete", () => {
  function subscribed() {
    const u = member();
    const { order } = createCheckout(u, "monthly_49");
    handleNotify(KEY, paid(order.id, "1.00"));
    return u;
  }

  it("cancel keeps access to the next charge date and asks the admin to stop the standing order", () => {
    const u = subscribed();
    cancelSubscription(u.id);
    const sub = getSubscription(u.id)!;
    expect(sub.status).toBe("canceled");
    expect(hasAccess(sub)).toBe(true); // still inside the trial
    expect(listProviderCancels(false)).toHaveLength(1);
  });

  it("resume before the admin acted withdraws the request; after, the member has to pay again", () => {
    const u = subscribed();
    cancelSubscription(u.id);
    expect(resumeSubscription(u.id)).toBe(true);
    expect(listProviderCancels(false)).toHaveLength(0);
    expect(getSubscription(u.id)!.status).toBe("trialing");

    cancelSubscription(u.id);
    db.exec("UPDATE provider_cancels SET done_at = datetime('now')");
    expect(resumeSubscription(u.id)).toBe(false);
  });

  it("deleting the account with a live subscription still queues the stop", () => {
    const u = subscribed();
    deleteOwnAccount(u.id);
    const [c] = listProviderCancels(false);
    expect(c.reason).toBe("deleted");
    expect(c.label).toContain("רות");
  });

  it("access after cancel runs to the next charge date", () => {
    expect(accessUntil("2026-01-15", "monthly_49", new Date("2026-03-20T00:00:00Z"))).toBe("2026-04-15 00:00:00");
    expect(accessUntil("2026-01-15", "quarterly_119", new Date("2026-03-20T00:00:00Z"))).toBe("2026-04-15 00:00:00");
    expect(accessUntil("2026-01-15", "quarterly_119", new Date("2026-01-10T00:00:00Z"))).toBe("2026-01-15 00:00:00");
  });
});
