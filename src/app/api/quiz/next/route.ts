import { handle, json, requireUser } from "@/lib/api";
import { nextQuestions } from "@/lib/checkin";

/** Three unanswered questions to offer between swipes. */
export const GET = handle(async () => {
  const user = await requireUser({ requireProfile: true });
  return json(nextQuestions(user.id, 3));
});
