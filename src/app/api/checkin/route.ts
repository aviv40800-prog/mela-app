import { handle, json, requireUser } from "@/lib/api";
import { getCheckin } from "@/lib/checkin";

/** The member's open "improve your profile" batch (answers go through /api/quiz; the batch closes itself). */
export const GET = handle(async () => {
  const user = await requireUser({ requireProfile: true });
  return json(getCheckin(user.id));
});
