import { handle, json, requireUser } from "@/lib/api";
import { dailyPicks } from "@/lib/matching";

export const GET = handle(async () => {
  const user = await requireUser({ requireSubscription: true });
  return json({ picks: dailyPicks(user) });
});
