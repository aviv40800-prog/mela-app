import { z } from "zod";
import { handle, json, error, requireUser } from "@/lib/api";
import { REPORT_REASONS, blockUser, reportUser, type ReportReason } from "@/lib/safety";
import { getUser } from "@/lib/users";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  reason: z.enum(Object.keys(REPORT_REASONS) as [ReportReason, ...ReportReason[]]),
  details: z.string().trim().max(1000).optional(),
  block: z.boolean().optional(),
});

/** Report a member to the admin (and, by default, block them too). */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const me = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id === me.id || !getUser(id)) return error("משתמש לא נמצא", 404);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("בחר/י סיבה לדיווח");
  reportUser(me.id, id, parsed.data.reason, parsed.data.details || null);
  if (parsed.data.block) blockUser(me.id, id);
  return json({ ok: true });
});
