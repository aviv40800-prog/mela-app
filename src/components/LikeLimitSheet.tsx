"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Crown, Heart, Share2 } from "lucide-react";
import { api, haptic } from "@/lib/client";

export type Quota = {
  premium: boolean;
  limit: number | null;
  used: number;
  left: number | null;
  resetsAt: string;
  share?: { shares: number; needed: number; bonus: number; claimed: boolean };
};

const INVITE_TEXT = "מצאתי פלטפורמת היכרויות של הקהילה — MELA, אהבה עם שורשים. בואו להצטרף, זה בחינם 🤎";

/** Opens the native share sheet (or WhatsApp). Resolves false if the member cancelled. */
export async function shareInvite(url: string, text = INVITE_TEXT): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share({ title: "MELA", text, url });
      return true;
    } catch (e) {
      if ((e as Error).name === "AbortError") return false;
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener");
  return true;
}

function countdown(to: string) {
  const ms = Math.max(0, new Date(to).getTime() - Date.now());
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** Shown when a free member runs out of daily likes. Passing keeps working; Premium removes the limit. */
export function LikeLimitSheet({ quota: initial, onClose, onQuota }: { quota: Quota; onClose: () => void; onQuota?: (q: Quota) => void }) {
  const [quota, setQuota] = useState(initial);
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(() => countdown(quota.resetsAt));
  const share = quota.share;
  // The member's personal link (fetched up front: iOS only opens the share sheet straight from the tap),
  // so a friend who joins through it earns them invite likes too.
  const [link, setLink] = useState<string | null>(null);
  useEffect(() => {
    api<{ link: string }>("/api/referral").then((r) => setLink(r.link), () => {});
  }, []);

  async function onShare() {
    if (busy) return;
    setBusy(true);
    try {
      if (!(await shareInvite(link ?? window.location.origin))) return;
      const { quota: q } = await api<{ quota: Quota | null }>("/api/quota/share", { method: "POST" });
      if (!q) return;
      setQuota(q);
      haptic(10);
      if (q.share?.claimed && q.left) {
        setUnlocked(true);
        haptic([20, 50, 20, 50, 30]);
        onQuota?.(q);
        setTimeout(onClose, 1800);
      }
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const t = setInterval(() => setLeft(countdown(quota.resetsAt)), 30_000);
    return () => clearInterval(t);
  }, [quota.resetsAt]);

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end bg-black/65 backdrop-blur-[6px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, i) => (i.offset.y > 110 || i.velocity.y > 500) && onClose()}
        onClick={(e) => e.stopPropagation()}
        className="surface relative mx-auto w-full max-w-md overflow-hidden rounded-t-[34px] px-6 pt-3 text-center safe-bottom"
        role="dialog"
        aria-label="נגמרו הלייקים להיום"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(184,137,43,0.25),transparent)]" />
        <div className="relative mx-auto mb-6 h-1 w-10 rounded-full bg-fg/20" />
        <motion.div
          initial={{ scale: 0.6, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 14 }}
          className="relative mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-b from-gold-3 to-gold text-[#2a1c12] shadow-[0_0_40px_rgba(184,137,43,0.6)]"
        >
          <Crown size={28} />
        </motion.div>
        <h2 className="font-display relative mt-5 text-[1.7rem] font-bold">נגמרו הלייקים להיום</h2>
        <p className="relative mt-2 text-[15px] text-mute">
          {(quota.limit ?? 0) - (share?.claimed ? share.bonus : 0)} לייקים חדשים יחכו לך בעוד <b className="tabular text-cream">{left}</b> שעות. בינתיים אפשר להמשיך לדפדף.
        </p>

        {/* Free way to keep going: share with friends */}
        {share && (!share.claimed || unlocked) && (
          <div className="relative mt-6 rounded-[24px] border border-gold/35 bg-gold/[0.07] p-4 text-right">
            <AnimatePresence mode="wait">
              {unlocked ? (
                <motion.div key="ok" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-2 text-center">
                  <motion.div animate={{ scale: [1, 1.25, 1] }} transition={{ duration: 0.8, repeat: 1 }} className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gradient-to-b from-[#ff6b70] to-[#b8141c] text-white">
                    <Heart size={22} className="fill-current" />
                  </motion.div>
                  <p className="mt-2 text-[16px] font-bold">קיבלת עוד {share.bonus} לייקים!</p>
                  <p className="text-[13px] text-mute">תודה שהפצת את MELA</p>
                </motion.div>
              ) : (
                <motion.div key="share" exit={{ opacity: 0 }}>
                  <p className="text-[15px] font-semibold">
                    שתפו את MELA עם {share.needed} חברים — וקבלו עוד {share.bonus} לייקים עכשיו
                  </p>
                  <div className="mt-3 flex items-center gap-2" aria-label={`${share.shares} מתוך ${share.needed}`}>
                    {Array.from({ length: share.needed }).map((_, i) => (
                      <motion.span
                        key={i}
                        animate={i < share.shares ? { scale: [1, 1.3, 1] } : {}}
                        className={`h-2.5 flex-1 rounded-full ${i < share.shares ? "bg-gradient-to-l from-gold-3 to-gold" : "bg-fg/10"}`}
                      />
                    ))}
                    <span className="tabular text-[12px] text-mute">
                      {share.shares}/{share.needed}
                    </span>
                  </div>
                  <button onClick={onShare} disabled={busy} className="btn-gold mt-3 w-full text-[15px]">
                    <Share2 size={16} /> {share.shares === 0 ? "שיתוף לחבר/ה" : `שיתוף לחבר/ה נוסף/ת (${share.shares + 1}/${share.needed})`}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <p className="relative mt-6 text-[13px] font-semibold text-gold-2">או בלי הגבלות, עם Premium:</p>
        <ul className="relative mx-auto mt-3 max-w-xs space-y-2.5 text-right text-[14.5px]">
          {["לייקים ללא הגבלה", "כל 3 הבחירות היומיות", "לראות מי כבר אהב/ה אותך"].map((t) => (
            <li key={t} className="flex items-center gap-2.5">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-gold/15 text-gold">
                <Check size={12} strokeWidth={3} />
              </span>
              {t}
            </li>
          ))}
        </ul>

        <Link href="/onboarding/plan" className={`${share && (!share.claimed || unlocked) ? "btn-ghost" : "btn-gold"} relative mt-5 w-full text-[16px]`}>
          שדרוג ל־Premium
        </Link>
        <button onClick={onClose} className="relative mt-2 mb-2 w-full py-2.5 text-sm text-mute transition hover:text-cream">
          להמשיך לדפדף
        </button>
      </motion.div>
    </motion.div>
  );
}
