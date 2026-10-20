import { handle, json, requireAdmin } from "@/lib/api";
import { createSession } from "@/lib/session";
import { startTestAccount } from "@/lib/test-account";

/** Admin only: a fresh sandbox account, signed in, at the start of sign-up (after the email code). */
export const POST = handle(async () => {
  await requireAdmin();
  const user = startTestAccount();
  await createSession(user.id);
  return json({ next: "/onboarding/account" });
});
