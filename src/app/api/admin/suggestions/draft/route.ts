import { z } from "zod";
import { handle, json, error, requireAdmin } from "@/lib/api";
import { draftSuggestionNotes } from "@/lib/suggestion-draft";
import { fallbackNotes } from "@/lib/auto-suggest";
import { getUser } from "@/lib/users";
import { markAiDown, markAiOk } from "@/lib/ai-health";

/**
 * "✨ Write it for me": AI-drafted notes for both sides — returned for the admin to edit, never sent from here.
 * When the AI isn't available (no key, out of credit, an outage), a plain note from what they share comes back
 * instead (`ai: false`), so there is always something to start from.
 */
export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin();
  const parsed = z.object({ a: z.number().int().positive(), b: z.number().int().positive() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("בקשה לא תקינה");
  const a = getUser(parsed.data.a);
  const b = getUser(parsed.data.b);
  if (!a || !b) return error("משתמש לא נמצא", 404);
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const notes = await draftSuggestionNotes(admin.id, a.id, b.id);
      markAiOk();
      return json({ ...notes, ai: true });
    } catch (e) {
      console.error("[suggestion-draft]", (e as Error).message);
      markAiDown(e);
    }
  }
  return json({ ...fallbackNotes(a, b), ai: false });
});
