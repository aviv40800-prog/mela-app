import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json, error, requireUser } from "@/lib/api";
import { ALL_QUESTIONS } from "@/lib/content";

const keys = ALL_QUESTIONS.map((q) => q.key) as [string, ...string[]];
const Body = z.object({ questionKey: z.enum(keys), choice: z.enum(["a", "b"]) });

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
  const parsed = Body.safeParse(await req.json().catch(() => null));
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
