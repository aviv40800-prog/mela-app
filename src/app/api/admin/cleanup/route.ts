import { z } from "zod";
import { handle, json, error, requireAdmin } from "@/lib/api";
import { deleteUsers, removeDemoMembers } from "@/lib/cleanup";

const Body = z.union([
  z.object({ action: z.literal("remove_demo"), confirm: z.literal("מחיקה") }),
  z.object({ action: z.literal("delete_users"), ids: z.array(z.number().int().positive()).min(1).max(500), confirm: z.literal("מחיקה") }),
]);

export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("בקשה לא תקינה — צריך לאשר במילה \"מחיקה\"");
  const b = parsed.data;
  if (b.action === "remove_demo") return json({ ok: true, removed: removeDemoMembers() });
  return json({ ok: true, ...deleteUsers(b.ids, admin.id) });
});
