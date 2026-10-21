import { z } from "zod";
import { handle, json, error, requireAdmin } from "@/lib/api";
import { SuggestionError, nudgeToChat } from "@/lib/suggestions";

const Body = z.object({ id: z.number().int().positive(), to: z.number().int().positive() });

/** Email one side of a matched suggestion: the other liked them back, time to write the first message. */
export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("בקשה לא תקינה");
  try {
    return json({ ok: true, ...nudgeToChat(parsed.data.id, parsed.data.to) });
  } catch (e) {
    if (e instanceof SuggestionError) return error(e.message);
    throw e;
  }
});
