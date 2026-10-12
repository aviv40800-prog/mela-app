"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { api, haptic } from "@/lib/client";
import { PreferencesFields, type Prefs } from "./PreferencesFields";

/** Bottom sheet to change discovery preferences any time. Calls onSaved with the new values. */
export function PreferencesSheet({ initial, onClose, onSaved }: { initial: Prefs; onClose: () => void; onSaved: (p: Prefs) => void }) {
  const [prefs, setPrefs] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const saved = await api<Prefs>("/api/me/preferences", { method: "PATCH", json: prefs });
      haptic(10);
      onSaved(saved);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-[6px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        onClick={(e) => e.stopPropagation()}
        className="surface mx-auto w-full max-w-md rounded-t-[34px] px-6 pt-3 safe-bottom"
        role="dialog"
        aria-label="העדפות חיפוש"
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">את מי להראות לי?</h2>
          <button onClick={onClose} className="text-mute transition hover:text-cream" aria-label="סגירה">
            <X size={20} />
          </button>
        </div>
        <PreferencesFields value={prefs} onChange={setPrefs} />
        {err && <p className="mt-4 text-sm text-danger">{err}</p>}
        <button onClick={save} disabled={busy} className="btn-gold mt-7 mb-2 w-full">
          {busy ? <Loader2 size={18} className="animate-spin" /> : "הצגת התוצאות"}
        </button>
      </motion.div>
    </motion.div>
  );
}
