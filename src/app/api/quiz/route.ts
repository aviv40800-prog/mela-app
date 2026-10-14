import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json, error, requireUser } from "@/lib/api";
import { ALL_QUESTIONS } from "@/lib/content";

const keys = ALL_QUESTIONS.map((q) => q.key) as [string, ...string[]];
const Body = z.object({ questionKey: z.enum(keys), choice: z.enum(["a", "b"]) });
// "Or write your own" in an interest pause: a free answer, kept for the profile picture we build (no match score).
const Open = z.object({ questionKey: z.enum(keys), text: z.string().trim().min(2).max(200) });

export const GET = handle(async () => {
  const user = await requireUser();
  const rows = db.prepare("SELECT question_key, choice FROM quiz_answers WHERE user_id = ?").all(user.id) as {
    question_key: string;
    choice: "a" | "b";
  }[];
  return json({ answers: Object.fromEntries(rows.map((r) => [r.question_key, r.choice])) });
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = await req.json().catch(() => null);
  const open = Open.safeParse(body);
  if (open.success && !(body && typeof body === "object" && "choice" in body)) {
    db.prepare(
      "INSERT INTO open_answers (user_id, question_key, answer_text) VALUES (?, ?, ?) ON CONFLICT(user_id, question_key) DO UPDATE SET answer_text = excluded.answer_text, created_at = datetime('now')",
    ).run(user.id, open.data.questionKey, open.data.text);
    return json({ ok: true, agreePercent: null });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return error("תשובה לא תקינה");
  db.prepare(
    "INSERT INTO quiz_answers (user_id, question_key, choice) VALUES (?, ?, ?) ON CONFLICT(user_id, question_key) DO UPDATE SET choice = excluded.choice",
  ).run(user.id, parsed.data.questionKey, parsed.data.choice);
  // Share of members who chose the same — fuels the "x% agree with you" moment.
  const { same, total } = db
    .prepare("SELECT SUM(choice = ?) AS same, COUNT(*) AS total FROM quiz_answers WHERE question_key = ?")
    .get(parsed.data.choice, parsed.data.questionKey) as { same: number; total: number };
  return json({ ok: true, agreePercent: Math.round((same / Math.max(1, total)) * 100) });
});
