import { z } from "zod";
import { error, handle, json, requireAdmin } from "@/lib/api";
import { getUser, getUserByEmail } from "@/lib/users";
import { applyUpay } from "@/lib/upay";

const Body = z.object({ eventId: z.number().int().positive(), member: z.string().trim().min(1, "מייל או מספר משתמש") });

/** The admin turns on Premium from a UPay payment that wasn't matched automatically. */
export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? "בקשה לא תקינה");
  const { eventId, member } = parsed.data;
  const user = /^\d+$/.test(member) ? getUser(Number(member)) : getUserByEmail(member);
  if (!user) return error("לא נמצא משתמש עם המייל או המספר הזה", 404);
  try {
    applyUpay(eventId, user.id);
  } catch (e) {
    return error((e as Error).message);
  }
  return json({ ok: true, userId: user.id, name: user.full_name });
});
