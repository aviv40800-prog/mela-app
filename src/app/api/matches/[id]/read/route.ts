import { handle, json, error, requireUser } from "@/lib/api";
import { matchPartner } from "@/lib/matching";
import { markRead } from "@/lib/chat";
import { publish } from "@/lib/events";

type Ctx = { params: Promise<{ id: string }> };

/** Marks the partner's messages as read. `?typing=1` instead broadcasts a typing indicator. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireUser({ requireProfile: true });
  const matchId = Number((await params).id);
  const partner = matchPartner(matchId, user.id);
  if (!partner) return error("השיחה לא נמצאה", 404);
  if (new URL(req.url).searchParams.get("typing")) publish(partner.id, { type: "typing", matchId, userId: user.id });
  else markRead(matchId, user.id, partner.id);
  return json({ ok: true });
});
