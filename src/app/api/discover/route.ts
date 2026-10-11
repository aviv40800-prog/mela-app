import { handle, json, requireUser } from "@/lib/api";
import { discoveryDeck } from "@/lib/matching";

export const GET = handle(async () => {
  const user = await requireUser({ requireSubscription: true });
  return json({ candidates: discoveryDeck(user) });
});
