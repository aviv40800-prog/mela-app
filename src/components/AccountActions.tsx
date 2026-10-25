"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, LogOut } from "lucide-react";
import { DEPARTURE_REASONS, type DepartureReason } from "@/lib/content";
import { api, haptic } from "@/lib/client";

export function MembershipActions({ canceled }: { canceled: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    haptic(12);
    const renew = await api("/api/subscription", { method: "PATCH", json: { action: canceled ? "resume" : "cancel" } })
      .then(() => false)
      .catch((e) => (e as { code?: string }).code === "renew");
    if (renew) return router.push("/onboarding/plan");
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

/** Delete my account: a quiet link → "why are you leaving?" (skippable) → a confirmation where the member types "מחיקה". */
export function DeleteAccount({ hasActivePlan }: { hasActivePlan: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"closed" | "why" | "confirm">("closed");
  const [reason, setReason] = useState<DepartureReason | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setErr(null);
    try {
      await api("/api/me", { method: "DELETE", json: { confirm: word.trim(), ...(reason && { reason }), ...(reason === "other" && reasonText.trim() && { reasonText: reasonText.trim() }) } });
      router.replace("/");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "משהו השתבש, נסו שוב");
      setBusy(false);
    }
  }

  const close = () => {
    setStep("closed");
    setReason(null);
    setReasonText("");
    setWord("");
  };

  return (
    <div className="mt-4 text-center">
      <AnimatePresence mode="wait" initial={false}>
        {step === "why" ? (
          <motion.div key="why" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="surface rounded-2xl p-4 text-right">
            <p className="text-[15px] font-semibold">לפני שהולכים, למה החלטת לעזוב?</p>
            <p className="mt-1 text-[12.5px] text-mute">זה עוזר לנו להשתפר. לא חובה.</p>
            <div role="radiogroup" aria-label="סיבת העזיבה" className="mt-3 flex flex-col gap-2">
              {(Object.keys(DEPARTURE_REASONS) as DepartureReason[]).map((k) => (
                <button
                  key={k}
                  role="radio"
                  aria-checked={reason === k}
                  onClick={() => setReason(k)}
                  className={`min-h-12 rounded-[14px] border px-4 text-start text-[14.5px] transition-colors ${reason === k ? "border-gold bg-gold/12 font-medium" : "border-line-2 hover:border-gold/50"}`}
                >
                  {DEPARTURE_REASONS[k]}
                </button>
              ))}
            </div>
            {reason === "other" && (
              <>
                <label htmlFor="leave-why" className="sr-only">
                  פירוט
                </label>
                <textarea
                  id="leave-why"
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  rows={3}
                  maxLength={300}
                  autoFocus
                  placeholder="רוצה לפרט? (לא חובה)"
                  className="field mt-2 w-full resize-none text-[14px] leading-relaxed"
                />
              </>
            )}
            <div className="mt-3 flex gap-2">
              <button onClick={() => setStep("confirm")} disabled={!reason} className="btn-gold flex-1 py-2.5 text-sm">
                המשך
              </button>
              <button onClick={() => (setReason(null), setStep("confirm"))} className="btn-ghost flex-1 py-2.5 text-sm">
                דלג
              </button>
            </div>
            <button onClick={close} className="mt-2 w-full py-1.5 text-center text-[12.5px] text-mute transition hover:text-cream">
              התחרטתי, אני נשאר/ת
            </button>
          </motion.div>
        ) : step === "confirm" ? (
          <motion.div key="confirm" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="surface rounded-2xl p-4 text-right">
            {reason === "found_here" && <p className="mb-2 text-[15px] font-semibold text-gold-2">מזל טוב! 💛 שמחים שמצאתם אחד את השני.</p>}
            <p className="text-[14px] font-semibold text-danger">מחיקת החשבון לצמיתות</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-mute">
              הפרופיל, התמונות, ההתאמות וכל השיחות יימחקו, ואי אפשר יהיה לשחזר אותם.
              {hasActivePlan && " המנוי שלך יבוטל, ולא יבוצעו חיובים נוספים."}
            </p>
            <label htmlFor="delete-confirm" className="mt-3 block text-[13px]">
              כדי לאשר, הקלד/י <b>מחיקה</b>
            </label>
            <input
              id="delete-confirm"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              autoComplete="off"
              className="field mt-1.5 w-full text-[15px]"
            />
            {err && <p className="mt-2 text-[13px] text-danger">{err}</p>}
            <div className="mt-3 flex gap-2">
              <button onClick={close} className="btn-gold flex-1 py-2.5 text-sm">
                ביטול
              </button>
              <button onClick={remove} disabled={busy || word.trim() !== "מחיקה"} className="btn-ghost flex-1 py-2.5 text-sm text-danger">
                {busy ? <Loader2 size={16} className="animate-spin" /> : "למחוק את החשבון"}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.button key="ask" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setStep("why")} className="py-2 text-[12.5px] text-mute-2 transition hover:text-danger">
            מחיקת החשבון
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
