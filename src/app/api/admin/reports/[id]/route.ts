import { z } from "zod";
import { handle, json, error, requireAdmin } from "@/lib/api";
import { setReportStatus } from "@/lib/safety";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ status: z.enum(["open", "handled"]) });

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  await requireAdmin();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("פעולה לא תקינה");
  setReportStatus(Number((await params).id), parsed.data.status);
  return json({ ok: true });
});
