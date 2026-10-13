"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Crown } from "lucide-react";

export type Quota = { premium: boolean; limit: number | null; used: number; left: number | null; resetsAt: string };

function countdown(to: string) {
  const ms = Math.max(0, new Date(to).getTime() - Date.now());
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** Shown when a free member runs out of daily likes. Passing keeps working; Premium removes the limit. */
export function LikeLimitSheet({ quota, onClose }: { quota: Quota; onClose: () => void }) {
  const [left, setLeft] = useState(() => countdown(quota.resetsAt));
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
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(180,87,58,0.25),transparent)]" />
        <div className="relative mx-auto mb-6 h-1 w-10 rounded-full bg-fg/20" />
        <motion.div
          initial={{ scale: 0.6, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 14 }}
          className="relative mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-b from-gold-3 to-gold text-ink shadow-[0_0_40px_rgba(180,87,58,0.6)]"
        >
          <Crown size={28} />
        </motion.div>
        <h2 className="font-display relative mt-5 text-[1.7rem] font-bold">נגמרו הלייקים להיום</h2>
        <p className="relative mt-2 text-[15px] text-mute">
          {quota.limit} לייקים חדשים יחכו לך בעוד <b className="tabular text-cream">{left}</b> שעות. בינתיים אפשר להמשיך לדפדף.
        </p>

        <ul className="relative mx-auto mt-6 max-w-xs space-y-2.5 text-right text-[14.5px]">
          {["לייקים ללא הגבלה", "כל 3 הבחירות היומיות", "לראות מי כבר אהב/ה אותך"].map((t) => (
            <li key={t} className="flex items-center gap-2.5">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-gold/15 text-gold">
                <Check size={12} strokeWidth={3} />
              </span>
              {t}
            </li>
          ))}
        </ul>

        <Link href="/onboarding/plan" className="btn-gold relative mt-7 w-full text-[16px]">
          שדרוג ל־Premium
        </Link>
        <button onClick={onClose} className="relative mt-2 mb-2 w-full py-2.5 text-sm text-mute transition hover:text-cream">
          להמשיך לדפדף
        </button>
      </motion.div>
    </motion.div>
  );
}
