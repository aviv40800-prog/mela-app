import { z } from "zod";
import { handle, json, error, requireUser } from "@/lib/api";
import { approvedQuestions, SEED_INSPIRATION, suggestQuestion } from "@/lib/community";

const Body = z.object({ text: z.string().max(400) });
const REASONS = {
  short: "קצת יותר — לפחות כמה מילים",
  long: "עד 160 תווים, בבקשה",
  limit: "תודה! אפשר להציע עד 3 שאלות ביום",
  duplicate: "מישהו כבר הציע את השאלה הזאת בדיוק",
};

/** Approved community questions (for chat ideas and inspiration chips). */
export const GET = handle(async () => {
  await requireUser();
  const approved = approvedQuestions();
  return json({ questions: approved, inspiration: (approved.length >= 3 ? approved : [...approved, ...SEED_INSPIRATION]).slice(0, 6) });
});

/** A member suggests a question for the community pool; it waits for admin review. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser({ requireProfile: true });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("שאלה לא תקינה");
  const res = suggestQuestion(user.id, parsed.data.text);
  if (!res.ok) return error(REASONS[res.reason], res.reason === "limit" ? 429 : 400);
  return json({ ok: true });
});
