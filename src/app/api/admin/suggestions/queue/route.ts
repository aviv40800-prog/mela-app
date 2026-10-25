import { z } from "zod";
import { handle, json, error, requireAdmin } from "@/lib/api";
import { SuggestionError } from "@/lib/suggestions";
import { approveQueued, buildQueue, pendingQueue, rejectQueued } from "@/lib/auto-suggest";

/** The AI matchmaker's drafts waiting for the team's OK. */
export const GET = handle(async () => {
  await requireAdmin();
  return json({ items: pendingQueue() });
});

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    id: z.number().int().positive(),
    noteA: z.string().trim().min(10, "נא לכתוב נימוק (לפחות 10 תווים)").max(600),
    noteB: z.string().trim().min(10, "נא לכתוב נימוק (לפחות 10 תווים)").max(600),
  }),
  z.object({ action: z.literal("reject"), id: z.number().int().positive() }),
  z.object({ action: z.literal("generate") }),
]);

export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? "בקשה לא תקינה");
  const b = parsed.data;
  if (b.action === "reject") {
    rejectQueued(b.id);
    return json({ ok: true });
  }
  if (b.action === "generate") return json({ ok: true, ...(await buildQueue()), items: pendingQueue() });
  try {
    return json({ ok: true, ...approveQueued(admin.id, b.id, b.noteA, b.noteB) });
  } catch (e) {
    if (e instanceof SuggestionError) return error(e.message);
    throw e;
  }
});
