"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, LogOut } from "lucide-react";
import { api, haptic } from "@/lib/client";

export function MembershipActions({ canceled }: { canceled: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    haptic(12);
    await api("/api/subscription", { method: "PATCH", json: { action: canceled ? "resume" : "cancel" } }).catch(() => {});
    setConfirm(false);
    setBusy(false);
    router.refresh();
  }

  if (canceled)
    return (
      <button onClick={toggle} disabled={busy} className="btn-gold mt-3 w-full py-3 text-sm">
        {busy ? <Loader2 size={16} className="animate-spin" /> : "חידוש המנוי"}
      </button>
    );

  return (
    <div className="mt-3">
      <AnimatePresence mode="wait" initial={false}>
        {confirm ? (
          <motion.div key="confirm" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="surface rounded-2xl p-4">
            <p className="text-sm">לבטל את המנוי? הגישה תישמר עד סוף התקופה, ולא יבוצע חיוב נוסף.</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setConfirm(false)} className="btn-gold flex-1 py-2.5 text-sm">
                השארו אותי
              </button>
              <button onClick={toggle} disabled={busy} className="btn-ghost flex-1 py-2.5 text-sm text-danger">
                {busy ? <Loader2 size={16} className="animate-spin" /> : "כן, לבטל"}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.button key="ask" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirm(true)} className="w-full py-2 text-center text-[12.5px] text-mute-2 transition hover:text-mute">
            ניהול / ביטול מנוי
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export function LogoutRow() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        await api("/api/auth/logout", { method: "POST" });
        router.replace("/");
        router.refresh();
      }}
      className="flex w-full items-center gap-3.5 px-4 py-4 text-right text-danger/90 transition-colors hover:bg-danger/[0.05]"
    >
      <span className="grid h-9 w-9 place-items-center rounded-xl border border-danger/20 bg-danger/[0.07]">
        {busy ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
      </span>
      <span className="text-[15px]">התנתקות</span>
    </button>
  );
}
