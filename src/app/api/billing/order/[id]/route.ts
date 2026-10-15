import { handle, json, error, requireUser } from "@/lib/api";
import { getOrder } from "@/lib/payments";

type Ctx = { params: Promise<{ id: string }> };

/** The checkout page polls this until Tranzila's notify marks the order paid (or failed). */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const order = getOrder((await params).id);
  if (!order || order.user_id !== user.id) return error("הזמנה לא נמצאה", 404);
  return json({ status: order.status, trial: !!order.trial, recurStart: order.recur_start });
});
