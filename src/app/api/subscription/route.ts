import { z } from "zod";
import { handle, json, error, requireUser } from "@/lib/api";
import { cancelSubscription, getSubscription, isMockBilling, resumeSubscription, startTrial } from "@/lib/billing";
import { isProfileComplete } from "@/lib/users";

const Body = z.object({
  plan: z.enum(["monthly_49", "quarterly_119"]),
  // Card metadata from the checkout form. In mock mode any number is accepted; a real PSP (Tranzila)
  // will tokenize the card in its hosted fields and send only a token + these display fields.
  card: z.object({
    brand: z.enum(["visa", "mastercard", "amex", "isracard", "diners", "card"]),
    last4: z.string().regex(/^\d{4}$/),
    exp: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/),
  }),
});

export const GET = handle(async () => {
  const user = await requireUser();
  return json({ subscription: getSubscription(user.id) });
});

/** Start the 7-day free trial on the chosen plan (₪0 today). */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  if (!isProfileComplete(user)) return error("יש להשלים פרופיל לפני בחירת מסלול", 409);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("פרטי התשלום לא תקינים");
  if (!isMockBilling()) return error("ספק התשלום עדיין לא מחובר", 503);
  return json({ subscription: startTrial(user.id, parsed.data.plan, parsed.data.card) });
});

const Patch = z.object({ action: z.enum(["cancel", "resume"]) });

export const PATCH = handle(async (req: Request) => {
  const user = await requireUser();
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("פעולה לא תקינה");
  if (parsed.data.action === "cancel") cancelSubscription(user.id);
  else resumeSubscription(user.id);
  return json({ subscription: getSubscription(user.id) });
});
