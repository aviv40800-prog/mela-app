import { z } from "zod";
import { handle, json, error, requireAdmin } from "@/lib/api";
import { getUser } from "@/lib/users";
import { SuggestionError, createSuggestion, notReadyReason, suggestionCandidates, suggestionsFor } from "@/lib/suggestions";

/** For one member: whether they can get a suggestion, who could be suggested, and past suggestions. */
export const GET = handle(async (req: Request) => {
  await requireAdmin();
  const user = getUser(Number(new URL(req.url).searchParams.get("userId")));
  const reason = notReadyReason(user);
  return json({ reason, candidates: reason ? [] : suggestionCandidates(user!), suggestions: user ? suggestionsFor(user.id) : [] });
});

const Body = z.object({
  a: z.number().int().positive(),
  b: z.number().int().positive(),
  noteA: z.string().trim().min(10, "נא לכתוב נימוק (לפחות 10 תווים)").max(600),
  noteB: z.string().trim().min(10, "נא לכתוב נימוק (לפחות 10 תווים)").max(600),
});

export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? "בקשה לא תקינה");
  const { a, b, noteA, noteB } = parsed.data;
  try {
    return json({ ok: true, ...createSuggestion(admin.id, a, b, noteA, noteB) });
  } catch (e) {
    if (e instanceof SuggestionError) return error(e.message);
    throw e;
  }
});
