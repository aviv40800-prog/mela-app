"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Ban, Flag, Loader2, ShieldCheck, X } from "lucide-react";
import { api, haptic } from "@/lib/client";

// Mirrors REPORT_REASONS in lib/safety.ts (server-only).
const REASONS = [
  ["harassment", "הטרדה או התנהגות פוגענית"],
  ["fake", "פרופיל מזויף או התחזות"],
  ["scam", "בקשת כסף או ניסיון הונאה"],
  ["sexual", "תוכן מיני לא רצוי"],
  ["underage", "נראה/ית מתחת לגיל 18"],
  ["other", "סיבה אחרת"],
] as const;

type Step = "menu" | "block" | "report" | "done";

/** Bottom sheet: block a member, or report them to the MELA team. `onBlocked` runs once they are blocked. */
export function SafetySheet({ userId, name, onClose, onBlocked }: { userId: number; name: string; onClose: () => void; onBlocked?: () => void }) {
  const first = name.split(" ")[0];
  const [step, setStep] = useState<Step>("menu");
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  async function run(path: string, body?: object, didBlock = false) {
    setBusy(true);
    setErr(null);
    try {
      await api(path, { method: "POST", json: body ?? {} });
      haptic(14);
      setBlocked(didBlock);
      setStep("done");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "משהו השתבש, נסו שוב");
    } finally {
      setBusy(false);
    }
  }

  function close() {
    onClose();
    if (blocked) onBlocked?.();
  }

  // Rendered at the top of the page: a swiping card or a blurred header would otherwise trap a fixed overlay inside it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <motion.div className="fixed inset-0 z-[60] flex items-end bg-black/60 backdrop-blur-[6px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`דיווח או חסימה של ${first}`}
        className="surface mx-auto max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[34px] px-6 pt-5 pb-6 safe-bottom"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-bold">
            {step === "report" ? `דיווח על ${first}` : step === "block" ? `לחסום את ${first}?` : step === "done" ? "תודה" : first}
          </h2>
          <button onClick={close} className="text-mute transition hover:text-cream" aria-label="סגירה">
            <X size={20} />
          </button>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {step === "menu" && (
            <motion.div key="menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2.5">
              <button onClick={() => setStep("report")} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-fg/[0.03] p-4 text-right transition hover:bg-fg/[0.06]">
                <Flag size={19} className="shrink-0 text-gold-2" />
                <span>
                  <span className="block font-semibold">דיווח</span>
                  <span className="text-[13px] text-mute">משהו לא תקין? הצוות של MELA יבדוק.</span>
                </span>
              </button>
              <button onClick={() => setStep("block")} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-fg/[0.03] p-4 text-right transition hover:bg-fg/[0.06]">
                <Ban size={19} className="shrink-0 text-danger" />
                <span>
                  <span className="block font-semibold">חסימה</span>
                  <span className="text-[13px] text-mute">לא תראו יותר אחד את השני.</span>
                </span>
              </button>
            </motion.div>
          )}

          {step === "block" && (
            <motion.div key="block" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p className="text-[14.5px] leading-relaxed text-cream/85">
                {first} לא יופיע/תופיע לך יותר, ולא יוכל/תוכל לראות אותך או לכתוב לך. אם יש ביניכם שיחה, היא תיסגר. {first} לא יקבל/תקבל הודעה על החסימה.
              </p>
              {err && <p className="mt-3 text-sm text-danger">{err}</p>}
              <div className="mt-5 flex gap-2">
                <button onClick={() => setStep("menu")} className="btn-ghost flex-1 py-3 text-sm">
                  חזרה
                </button>
                <button onClick={() => run(`/api/users/${userId}/block`, undefined, true)} disabled={busy} className="btn-gold flex-1 py-3 text-sm">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : "כן, לחסום"}
                </button>
              </div>
            </motion.div>
          )}

          {step === "report" && (
            <motion.div key="report" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p className="mb-3 text-[13.5px] text-mute">הדיווח אנונימי. {first} לא יודע/ת מי דיווח/ה.</p>
              <div className="space-y-2" role="radiogroup" aria-label="סיבת הדיווח">
                {REASONS.map(([key, label]) => (
                  <button
                    key={key}
                    role="radio"
                    aria-checked={reason === key}
                    onClick={() => setReason(key)}
                    className={`w-full rounded-2xl border px-4 py-3 text-right text-[14.5px] transition ${reason === key ? "border-gold/60 bg-gold/[0.08] text-cream" : "border-line bg-fg/[0.02] text-cream/85 hover:bg-fg/[0.05]"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="field mt-3 !p-0">
                <textarea
                  value={details}
                  maxLength={1000}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="רוצה לפרט? (לא חובה)"
                  aria-label="פרטים נוספים"
                  className="min-h-20 w-full resize-none bg-transparent px-4 py-3 text-[15px] outline-none placeholder:text-mute-2"
                />
              </div>
              <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-[14px]">
                <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} className="h-4 w-4 accent-[#e5283b]" />
                לחסום גם את {first}
              </label>
              {err && <p className="mt-3 text-sm text-danger">{err}</p>}
              <button
                onClick={() => run(`/api/users/${userId}/report`, { reason, details: details.trim() || undefined, block: alsoBlock }, alsoBlock)}
                disabled={!reason || busy}
                className="btn-gold mt-5 w-full py-3 text-sm"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : "שליחת דיווח"}
              </button>
            </motion.div>
          )}

          {step === "done" && (
            <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
              <ShieldCheck size={40} className="mx-auto text-gold-2" />
              <p className="mt-3 text-[15px] leading-relaxed">
                {reason ? "הדיווח התקבל, והצוות שלנו יבדוק אותו." : ""} {blocked ? `${first} חסום/ה ולא יופיע/תופיע לך יותר.` : ""}
              </p>
              <button onClick={close} className="btn-gold mt-5 w-full py-3 text-sm">
                סגירה
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

/** A quiet "report or block" link, for the bottom of a profile. */
export function SafetyLink({ userId, name, onBlocked }: { userId: number; name: string; onBlocked?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="mx-auto flex items-center gap-1.5 py-3 text-[12.5px] text-mute-2 transition hover:text-mute">
        <Flag size={13} /> דיווח או חסימה של {name.split(" ")[0]}
      </button>
      <AnimatePresence>{open && <SafetySheet userId={userId} name={name} onClose={() => setOpen(false)} onBlocked={onBlocked} />}</AnimatePresence>
    </>
  );
}
