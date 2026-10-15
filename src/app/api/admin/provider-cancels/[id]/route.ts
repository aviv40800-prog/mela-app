import { handle, json, requireAdmin } from "@/lib/api";
import { markProviderCancelDone } from "@/lib/payments";

type Ctx = { params: Promise<{ id: string }> };

/** The admin stopped this standing order in Tranzila. */
export const PATCH = handle(async (_req: Request, { params }: Ctx) => {
  await requireAdmin();
  markProviderCancelDone(Number((await params).id));
  return json({ ok: true });
});
