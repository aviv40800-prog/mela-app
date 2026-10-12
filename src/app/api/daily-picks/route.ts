import { handle, json, requireUser } from "@/lib/api";
import { dailyPicks } from "@/lib/matching";
import { FREE_DAILY_PICKS, getQuota } from "@/lib/quota";

export const GET = handle(async () => {
  const user = await requireUser({ requireProfile: true });
  const quota = getQuota(user.id);
  // Free members see one pick in full; the rest are teasers (first name + main photo only).
  const picks = dailyPicks(user).map((p, i) =>
    quota.premium || i < FREE_DAILY_PICKS
      ? { ...p, locked: false, likedYou: quota.premium && p.likedYou }
      : { ...p, locked: true, likedYou: false, bio: null, occupation: null, prompts: [], photos: p.photos.slice(0, 1), full_name: p.full_name.split(" ")[0] },
  );
  return json({ picks, quota });
});
