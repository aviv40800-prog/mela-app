import { z } from "zod";
import { handle, json, error, requireUser } from "@/lib/api";
import { createCheckout, isTranzilaBilling } from "@/lib/payments";
import { getSubscription, hasAccess } from "@/lib/billing";
import { isProfileComplete } from "@/lib/users";

const Body = z.object({ plan: z.enum(["monthly_49", "quarterly_119"]) });

/** Starts a Tranzila checkout: a pending order plus the form fields that open the payment iFrame. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  if (!isTranzilaBilling()) return error("התשלום עדיין לא פעיל", 503);
  if (!isProfileComplete(user)) return error("יש להשלים פרופיל לפני בחירת מסלול", 409);
  if (hasAccess(getSubscription(user.id))) return error("יש לך כבר מנוי פעיל");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("מסלול לא תקין");
  const { order, action, fields } = createCheckout(user, parsed.data.plan);
  return json({ orderId: order.id, action, fields });
});
