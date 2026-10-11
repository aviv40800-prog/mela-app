import { z } from "zod";
import { handle, json, error, requireUser } from "@/lib/api";
import { matchPartner } from "@/lib/matching";
import { listMessages, sendMessage } from "@/lib/chat";
import { maybeDemoReply } from "@/lib/demo";
import { toPublic } from "@/lib/users";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireUser({ requireSubscription: true });
  const matchId = Number((await params).id);
  const partner = matchPartner(matchId, user.id);
  if (!partner) return error("השיחה לא נמצאה", 404);
  const after = Number(new URL(req.url).searchParams.get("after") ?? 0);
  return json({ partner: toPublic(partner), messages: listMessages(matchId, after) });
});

const Body = z.object({ text: z.string().trim().min(1).max(2000) });

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireUser({ requireSubscription: true });
  const matchId = Number((await params).id);
  const partner = matchPartner(matchId, user.id);
  if (!partner) return error("השיחה לא נמצאה", 404);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("הודעה ריקה");
  const message = sendMessage(matchId, user.id, partner.id, parsed.data.text);
  maybeDemoReply(matchId, partner.id, user.id);
  return json({ message });
});
