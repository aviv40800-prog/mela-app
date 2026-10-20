"use client";

import { useState } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import { api } from "@/lib/client";

/** Opens sign-up as a brand-new member would see it, on a sandbox account (no email code). */
export function TestSignupButton() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function start() {
    if (!confirm("נפתח חשבון טסט חדש ותועבר/י להרשמה כמו לקוח. בסוף תצטרך/י להתחבר שוב לחשבון המנהל עם שם המשתמש והסיסמה. להמשיך?")) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ next: string }>("/api/admin/test-account", { method: "POST" });
      try {
        localStorage.removeItem("mela:journey");
        localStorage.removeItem("mela:swipe-tutorial-done");
      } catch {}
      window.location.assign(r.next);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={start} disabled={busy} className="btn-ghost py-2.5 text-sm">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <FlaskConical size={15} />} לחוות את ההרשמה כמו לקוח
      </button>
      {err && <span className="text-xs text-danger">{err}</span>}
    </div>
  );
}
