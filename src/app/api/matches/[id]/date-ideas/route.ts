import { handle, json, error, requireUser } from "@/lib/api";
import { matchPartner } from "@/lib/matching";
import { datePlan } from "@/lib/dates";

type Ctx = { params: Promise<{ id: string }> };

/** Three date ideas tailored to this pair. `?round=n` reshuffles for "more ideas". */
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireUser({ requireProfile: true });
  const matchId = Number((await params).id);
  const partner = matchPartner(matchId, user.id);
  if (!partner) return error("השיחה לא נמצאה", 404);
  const round = Math.max(0, Math.min(50, Number(new URL(req.url).searchParams.get("round")) || 0));
  return json({ plan: datePlan(user, partner, round) });
});
