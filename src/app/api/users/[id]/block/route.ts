import { handle, json, error, requireUser } from "@/lib/api";
import { blockUser } from "@/lib/safety";
import { getUser } from "@/lib/users";

type Ctx = { params: Promise<{ id: string }> };

/** Block a member: neither side sees the other again, and any chat between them closes. */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const me = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id === me.id || !getUser(id)) return error("משתמש לא נמצא", 404);
  blockUser(me.id, id);
  return json({ ok: true });
});
