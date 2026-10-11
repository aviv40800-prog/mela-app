import { handle, json, requireUser } from "@/lib/api";
import { likesReceived, listMatches } from "@/lib/matching";

export const GET = handle(async () => {
  const user = await requireUser({ requireSubscription: true });
  return json({ matches: listMatches(user.id), likes: likesReceived(user.id) });
});
