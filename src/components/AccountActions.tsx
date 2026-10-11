"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { api } from "@/lib/client";

export function AccountActions({ canceled }: { canceled: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    await api("/api/subscription", { method: "PATCH", json: { action: canceled ? "resume" : "cancel" } }).catch(() => {});
    setConfirm(false);
    setBusy(false);
    router.refresh();
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="mt-4 flex gap-2">
      {canceled ? (
        <button onClick={toggle} disabled={busy} className="btn-gold flex-1 py-2.5 text-sm">
          חידוש מנוי
        </button>
      ) : confirm ? (
        <>
          <button onClick={toggle} disabled={busy} className="btn-ghost flex-1 border-danger/40 py-2.5 text-sm text-danger">
            כן, לבטל
          </button>
          <button onClick={() => setConfirm(false)} className="btn-ghost flex-1 py-2.5 text-sm">
            השארו אותי
          </button>
        </>
      ) : (
        <button onClick={() => setConfirm(true)} className="btn-ghost flex-1 py-2.5 text-sm text-mute">
          ביטול מנוי
        </button>
      )}
      <button onClick={logout} className="btn-ghost py-2.5 text-sm text-mute" aria-label="התנתקות">
        <LogOut size={16} />
      </button>
    </div>
  );
}
