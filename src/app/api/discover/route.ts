import { handle, json, requireUser } from "@/lib/api";
import { discoveryDeck } from "@/lib/matching";
import { getQuota } from "@/lib/quota";

export const GET = handle(async () => {
  const user = await requireUser({ requireProfile: true });
  const quota = getQuota(user.id);
  // "Liked you" badges are a Premium feature; free members still match normally by liking back.
  const candidates = discoveryDeck(user).map((c) => (quota.premium ? c : { ...c, likedYou: false }));
  return json({ candidates, quota });
});
