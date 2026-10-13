import { handle, json, requireUser } from "@/lib/api";
import { isPremium, recordShare } from "@/lib/quota";

/** The member shared an invite; the third share today unlocks bonus likes. */
export const POST = handle(async () => {
  const user = await requireUser({ requireProfile: true });
  if (isPremium(user.id)) return json({ quota: null });
  return json({ quota: recordShare(user.id) });
});
