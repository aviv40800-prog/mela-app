import { handle, json, requireUser } from "@/lib/api";
import { discoverFeed } from "@/lib/matching";
import { getQuota } from "@/lib/quota";
import { suggestedCards } from "@/lib/suggestions";
import { isTestUser } from "@/lib/test-account";

export const GET = handle(async () => {
  const user = await requireUser({ requireProfile: true });
  const quota = getQuota(user.id);
  // A sandbox account sees the "next match is on its way" path, never real members.
  if (isTestUser(user.id)) return json({ candidates: [], quota, widened: false, swipes: 0 });
  // "Liked you" badges are a Premium feature; free members still match normally by liking back.
  const feed = discoverFeed(user);
  // Personal suggestions from the team come first.
  const suggested = suggestedCards(user);
  const ids = new Set(suggested.map((c) => c.id));
  const candidates = [...suggested, ...feed.candidates.filter((c) => !ids.has(c.id))].map((c) => (quota.premium ? c : { ...c, likedYou: false }));
  return json({ candidates, quota, widened: feed.widened, swipes: feed.swipes });
});
