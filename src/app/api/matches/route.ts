import { handle, json, requireUser } from "@/lib/api";
import { likesReceived, listMatches } from "@/lib/matching";
import { isPremium } from "@/lib/quota";

export const GET = handle(async () => {
  const user = await requireUser({ requireProfile: true });
  const likes = likesReceived(user.id);
  return json({ matches: listMatches(user.id), likes: isPremium(user.id) ? likes : { count: likes.length } });
});
