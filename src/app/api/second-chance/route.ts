import { handle, json, requireUser } from "@/lib/api";
import { secondChanceDeck } from "@/lib/second-chance";

/** Passed profiles that may get a second chance, best compatibility first. */
export const GET = handle(async () => {
  const user = await requireUser({ requireProfile: true });
  return json({ candidates: secondChanceDeck(user) });
});
