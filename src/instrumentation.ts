/** Runs once when the server starts: a light background loop for the signup reminder emails. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.VITEST) return;
  const { sendSignupReminders } = await import("./lib/reminders");
  const tick = () => {
    try {
      const n = sendSignupReminders();
      if (n) console.log(`[reminders] sent ${n} signup reminder(s)`);
    } catch (e) {
      console.error("[reminders] failed", (e as Error).message);
    }
  };
  setTimeout(tick, 60_000);
  setInterval(tick, 10 * 60_000);
}
