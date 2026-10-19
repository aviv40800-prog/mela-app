import { handle, json, requireUser } from "@/lib/api";
import { nextQuestions } from "@/lib/checkin";

/** Unanswered questions to offer between swipes (3), or for the short chat with MELA (?n=, up to 8). */
export const GET = handle(async (req: Request) => {
  const user = await requireUser({ requireProfile: true });
  const n = Math.min(8, Math.max(1, Number(new URL(req.url).searchParams.get("n")) || 3));
  return json(nextQuestions(user.id, n));
});
