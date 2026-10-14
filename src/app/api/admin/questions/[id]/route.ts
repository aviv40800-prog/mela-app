import { z } from "zod";
import { handle, json, error, requireAdmin } from "@/lib/api";
import { reviewQuestion } from "@/lib/community";

type Ctx = { params: Promise<{ id: string }> };
const Patch = z.object({ status: z.enum(["pending", "approved", "rejected"]), text: z.string().trim().min(8).max(160).optional() });

/** Approve / reject (optionally lightly editing) a community-suggested question. */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  await requireAdmin();
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("בקשה לא תקינה");
  if (!reviewQuestion(Number((await params).id), parsed.data.status, parsed.data.text)) return error("השאלה לא נמצאה", 404);
  return json({ ok: true });
});
