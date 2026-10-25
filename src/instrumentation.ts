/** Runs once when the server starts: a light background loop for the signup reminder emails and the nightly AI matchmaker. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.VITEST) return;
  const { sendSecondReminders, sendSignupReminders } = await import("./lib/reminders");
  const { maybeRunNightly } = await import("./lib/auto-suggest");
  const { saveStuckChats } = await import("./lib/chat-save");
  try {
    const n = saveStuckChats();
    if (n) console.log(`[chat-save] saved ${n} finished sign-up chat(s) that were never approved`);
  } catch (e) {
    console.error("[chat-save] catch-up failed", (e as Error).message);
  }
  const tick = () => {
    try {
      const n = sendSignupReminders();
      if (n) console.log(`[reminders] sent ${n} signup reminder(s)`);
      const n2 = sendSecondReminders();
      if (n2) console.log(`[reminders] sent ${n2} second signup reminder(s)`);
    } catch (e) {
      console.error("[reminders] failed", (e as Error).message);
    }
    maybeRunNightly()
      .then((n) => n && console.log(`[auto-suggest] drafted ${n} suggestion(s) for review`))
      .catch((e) => console.error("[auto-suggest] failed", (e as Error).message));
  };
  setTimeout(tick, 60_000);
  setInterval(tick, 10 * 60_000);
}
