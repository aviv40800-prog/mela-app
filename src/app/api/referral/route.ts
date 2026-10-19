import { handle, json, requireUser } from "@/lib/api";
import { referralStats } from "@/lib/referral";

/** The member's personal invite link and what it has earned them. */
export const GET = handle(async () => {
  const user = await requireUser({ requireProfile: true });
  return json(referralStats(user.id));
});
