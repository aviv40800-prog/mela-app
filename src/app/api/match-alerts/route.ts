import { z } from "zod";
import { handle, json, error, requireUser } from "@/lib/api";
import { matchAlertsOn, setMatchAlerts } from "@/lib/match-alerts";

export const GET = handle(async () => {
  const user = await requireUser({ requireProfile: true });
  return json({ on: matchAlertsOn(user.id), canEmail: !!(user.email && user.email_verified) });
});

/** "Email me when someone who fits joins" — needs a verified email. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser({ requireProfile: true });
  const parsed = z.object({ on: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("בקשה לא תקינה");
  if (parsed.data.on && !(user.email && user.email_verified)) return error("כדי לקבל התראות צריך כתובת מייל מאומתת");
  setMatchAlerts(user.id, parsed.data.on);
  return json({ on: parsed.data.on });
});
