"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Crown, Loader2, Lock } from "lucide-react";
import { haptic } from "@/lib/client";
import { PLANS, TRIAL_DAYS, type PlanType } from "@/lib/content";

const PERKS = ["לייקים ללא הגבלה", "כל 3 הבחירות האישיות בכל יום", "לראות מי אהב/ה אותך", "צ'אט בזמן אמת + פתיחים מהבית", "התראת וואטסאפ על כל התאמה"];

function chargeDate() {
  const d = new Date();
  d.setDate(d.getDate() + TRIAL_DAYS);
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "long" });
}

export function PlanPicker({ firstName, returning, welcome, freeLikes }: { firstName: string; returning: boolean; welcome: boolean; freeLikes: number }) {
  const router = useRouter();
  const [plan, setPlan] = useState<PlanType>("quarterly_119");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const selected = PLANS[plan];

  function start() {
    setBusy(true);
    setErr(null);
    router.push(`/onboarding/checkout?plan=${plan}${welcome ? "&welcome=1" : ""}`);
  }

  return (
    <div className="animate-rise mt-8 flex flex-1 flex-col pb-56">
      <div className="text-center">
        {!returning && (
          <div className="glow mx-auto mb-4 w-fit rounded-full bg-gold/10 px-4 py-1.5 text-xs font-semibold text-gold-2">
            🎁 {TRIAL_DAYS} ימים חינם · ₪0 היום
          </div>
        )}
        <h1 className="font-display text-[2rem] leading-tight font-bold">
          {welcome ? (
            <>
              {firstName ? `${firstName}, ` : ""}הפרופיל <span className="gold-text">מוכן!</span>
            </>
          ) : (
            <>
              שדרוג ל־<span className="gold-text">MELA Premium</span>
            </>
          )}
        </h1>
        <p className="mt-2 text-sm text-mute">
          {welcome ? "אפשר להתחיל בחינם, או לפתוח את כל האפשרויות עם Premium." : "יותר לייקים, יותר בחירות, יותר סיכוי למצוא את האחד/ת."}
        </p>
      </div>

      <div className="mt-8 space-y-3" role="radiogroup">
        {(["quarterly_119", "monthly_49"] as const).map((id) => {
          const p = PLANS[id];
          const active = plan === id;
          return (
            <motion.button
              key={id}
              role="radio"
              aria-checked={active}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                haptic(6);
                setPlan(id);
              }}
              className={`surface relative w-full rounded-[26px] p-5 text-right transition-opacity duration-300 ${active ? "" : "opacity-75"}`}
            >
              {active && (
                <motion.span
                  layoutId="plan-active"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className="glow pointer-events-none absolute inset-0 rounded-[26px] bg-gradient-to-b from-gold/[0.14] to-gold/[0.02]"
                />
              )}
              {"badge" in p && (
                <span className="absolute -top-3 right-5 flex items-center gap-1 rounded-full bg-gradient-to-l from-gold-2 to-gold px-3 py-1 text-[11px] font-bold text-ink shadow-lg">
                  <Crown size={12} /> {p.badge}
                </span>
              )}
              <div className="relative flex items-center gap-4">
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition ${active ? "border-gold bg-gold text-ink" : "border-white/25"}`}
                >
                  {active && <Check size={14} strokeWidth={3} />}
                </span>
                <div className="flex-1">
                  <div className="text-lg font-semibold">{p.title}</div>
                  <div className="text-xs text-mute">{p.note}</div>
                </div>
                <div className="text-left">
                  <div className="font-display text-2xl font-bold" dir="ltr">
                    {p.priceLabel}
                  </div>
                  <div className="text-[11px] text-mute">{id === "quarterly_119" ? `≈ ₪${p.perMonth.toFixed(0)} לחודש` : p.period}</div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 text-center text-[12px]">
        <div className="rounded-2xl border border-line bg-white/[0.02] p-3">
          <div className="font-semibold text-cream">חינם</div>
          <div className="mt-1 text-mute">{freeLikes} לייקים ביום · בחירה 1 ביום · צ׳אט</div>
        </div>
        <div className="rounded-2xl border border-gold/35 bg-gold/[0.06] p-3">
          <div className="font-semibold text-gold-2">Premium</div>
          <div className="mt-1 text-cream/80">ללא הגבלה · 3 בחירות · מי אהב/ה אותך</div>
        </div>
      </div>

      <ul className="mt-6 space-y-2.5">
        {PERKS.map((perk) => (
          <li key={perk} className="flex items-center gap-3 text-sm">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-gold/15 text-gold">
              <Check size={12} strokeWidth={3} />
            </span>
            {perk}
          </li>
        ))}
      </ul>

      {!returning && (
        <div className="surface mt-8 rounded-2xl p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-mute">לתשלום היום</span>
            <span className="font-bold text-gold-2">₪0.00</span>
          </div>
          <div className="mt-2 flex justify-between">
            <span className="text-mute">החל מ־{chargeDate()}</span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={plan} dir="ltr" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                {selected.priceLabel} / {selected.months === 1 ? "חודש" : "3 חודשים"}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md bg-gradient-to-t from-ink via-ink/95 to-transparent px-6 pt-8 pb-[max(env(safe-area-inset-bottom),20px)]">
        {err && <p className="mb-2 text-center text-sm text-danger">{err}</p>}
        <button className="btn-gold w-full text-lg" onClick={start} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" size={18} /> : returning ? "המשך לתשלום" : `המשך · ${TRIAL_DAYS} ימי ניסיון חינם`}
        </button>
        <button
          onClick={() => router.replace("/discover")}
          className={welcome ? "btn-ghost mt-2.5 w-full py-3 text-[14px]" : "mt-2 w-full py-2.5 text-center text-sm text-mute transition hover:text-cream"}
        >
          {welcome ? `להמשיך בחינם — ${freeLikes} לייקים ביום, בלי כרטיס אשראי` : "אולי אחר כך"}
        </button>
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-mute-2">
          <Lock size={11} /> תשלום מאובטח · ביטול בלחיצה מהפרופיל
        </p>
      </div>
    </div>
  );
}
