"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { ArrowLeft, ArrowRight, ChevronsDown, Hand, Heart, X } from "lucide-react";

const KEY = "mela:swipe-tutorial-done";

type Step = { dir: 1 | -1 | 0; title: string; sub: string };
const STEPS: Step[] = [
  { dir: 1, title: "החלקה ימינה = לייק", sub: "מישהו/י מוצא/ת חן בעיניך? החליקו ימינה או לחצו על הלב האדום." },
  { dir: -1, title: "החלקה שמאלה = לא הפעם", sub: "לא מתאים? החליקו שמאלה או לחצו על ה־✕. אף אחד לא יודע." },
  { dir: 0, title: "גוללים למטה כדי להכיר", sub: "בכל כרטיס יש עוד תמונות, תשובות ושאלות מהבית — שווה להציץ." },
];

/**
 * First-visit walkthrough on Discover: three blank demo profiles act out like (right), pass (left) and
 * scroll-to-read, with arrows and a hand, then hand over to the real deck. Shown once per device.
 */
export function SwipeTutorial() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const card = useAnimationControls();
  const hand = useAnimationControls();

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) !== "1") setShow(true);
    } catch {}
  }, []);

  // Act out the current step, then move on.
  useEffect(() => {
    if (!show || step >= STEPS.length) return;
    let alive = true;
    const { dir } = STEPS[step];
    (async () => {
      await card.set({ x: 0, y: 0, rotate: 0, opacity: 1 });
      await hand.set({ x: 0, y: 0, opacity: 0 });
      await new Promise((r) => setTimeout(r, 700));
      if (!alive) return;
      if (dir !== 0) {
        await hand.start({ opacity: 1, transition: { duration: 0.25 } });
        // drag a little, hold so the stamp reads, then throw
        await Promise.all([
          card.start({ x: dir * 70, rotate: dir * 7, transition: { type: "spring", stiffness: 120, damping: 16 } }),
          hand.start({ x: dir * 70, transition: { type: "spring", stiffness: 120, damping: 16 } }),
        ]);
        await new Promise((r) => setTimeout(r, 900));
        if (!alive) return;
        hand.start({ opacity: 0, transition: { duration: 0.2 } });
        await card.start({ x: dir * 460, rotate: dir * 18, transition: { duration: 0.45, ease: [0.4, 0, 0.6, 1] } });
      } else {
        await hand.start({ opacity: 1, transition: { duration: 0.25 } });
        await Promise.all([
          card.start({ y: [0, -46, 0, -46, 0], transition: { duration: 2.2, ease: "easeInOut" } }),
          hand.start({ y: [0, -60, 0, -60, 0], transition: { duration: 2.2, ease: "easeInOut" } }),
        ]);
        hand.start({ opacity: 0 });
      }
      await new Promise((r) => setTimeout(r, 450));
      if (alive) setStep((s) => s + 1);
    })();
    return () => {
      alive = false;
    };
  }, [show, step, card, hand]);

  function finish() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setShow(false);
  }

  const current = STEPS[Math.min(step, STEPS.length - 1)];
  const done = step >= STEPS.length;
  const remaining = STEPS.length - Math.min(step, STEPS.length);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[60] flex flex-col bg-ink/95 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-label="הדרכה: איך עושים סוויפ"
        >
          <div className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),18px)]">
            <span className="eyebrow">הדרכה קצרה · {Math.min(step + 1, STEPS.length)}/{STEPS.length}</span>
            <button onClick={finish} className="text-[13px] text-mute transition hover:text-cream">
              דילוג
            </button>
          </div>

          <div className="mt-4 px-6 text-center">
            <AnimatePresence mode="wait">
              <motion.div key={done ? "done" : step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <h2 className="font-display text-[1.75rem] leading-tight font-bold">{done ? "מוכנים? יאללה!" : current.title}</h2>
                <p className="mx-auto mt-2 max-w-xs text-[14.5px] leading-relaxed text-mute">
                  {done ? "עכשיו זה אמיתי — האנשים הבאים מחכים לך." : current.sub}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* the stage: arrows on both sides, a stack of demo cards in the middle */}
          <div dir="ltr" className="relative mx-auto mt-6 flex w-full max-w-md flex-1 items-center justify-center px-4">
            <SideArrow side="left" active={!done && current.dir === -1} />
            <div className="relative h-[46vh] max-h-[400px] w-[66%]">
              {Array.from({ length: remaining }).map((_, i) => {
                const isTop = i === remaining - 1;
                const depth = remaining - 1 - i;
                return isTop && !done ? (
                  <motion.div key={`top-${step}`} animate={card} className="absolute inset-0 z-10" style={{ transformOrigin: "50% 110%" }}>
                    <DemoCard n={step + 1} stamp={current.dir} />
                  </motion.div>
                ) : (
                  <div key={`back-${i}`} className="absolute inset-0" style={{ transform: `translateY(${depth * 10}px) scale(${1 - depth * 0.05})`, opacity: 1 - depth * 0.25 }}>
                    <DemoCard n={step + 1 + depth} stamp={0} />
                  </div>
                );
              })}
              {done && (
                <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="absolute inset-0 grid place-items-center">
                  <div className="grid h-24 w-24 place-items-center rounded-full bg-gradient-to-b from-[#ff6b70] to-[#b8141c] text-white shadow-[0_18px_40px_-12px_rgba(229,56,59,0.7)]">
                    <Heart size={42} className="fill-current" />
                  </div>
                </motion.div>
              )}
              {!done && (
                <motion.div animate={hand} initial={{ opacity: 0 }} className="pointer-events-none absolute bottom-[18%] left-1/2 z-20 -ml-5 text-cream drop-shadow-[0_6px_10px_rgba(0,0,0,0.25)]">
                  <Hand size={40} strokeWidth={1.6} className="fill-ink-3" />
                </motion.div>
              )}
              {!done && current.dir === 0 && (
                <motion.div
                  animate={{ y: [0, 8, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="absolute -bottom-9 left-1/2 -ml-3 text-gold"
                >
                  <ChevronsDown size={24} />
                </motion.div>
              )}
            </div>
            <SideArrow side="right" active={!done && current.dir === 1} />
          </div>

          {/* the real buttons, same sides as the swipes */}
          <div dir="ltr" className="mt-10 flex items-center justify-center gap-7">
            <ButtonHint active={!done && current.dir === -1} label="לא הפעם">
              <div className="grid h-[58px] w-[58px] place-items-center rounded-full border border-fg/15 bg-ink-3 text-cream/85">
                <X size={26} strokeWidth={2.4} />
              </div>
            </ButtonHint>
            <ButtonHint active={!done && current.dir === 1} label="לייק">
              <div className="grid h-[68px] w-[68px] place-items-center rounded-full bg-gradient-to-b from-[#ff6b70] via-[#e5383b] to-[#b8141c] text-white shadow-[0_12px_30px_-10px_rgba(229,56,59,0.8)]">
                <Heart size={28} className="fill-current" />
              </div>
            </ButtonHint>
          </div>

          <div className="px-6 pt-8 safe-bottom">
            <button onClick={finish} className={`w-full ${done ? "btn-gold" : "btn-ghost"}`}>
              {done ? "בואו נתחיל" : "הבנתי, אפשר להתחיל"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DemoCard({ n, stamp }: { n: number; stamp: 1 | -1 | 0 }) {
  return (
    <div className="leather on-dark relative h-full w-full overflow-hidden rounded-[28px] shadow-[var(--shadow-float)]">
      <div className="absolute top-4 right-4 rounded-full border border-fg/25 bg-black/20 px-3 py-1 text-[11px] font-semibold backdrop-blur-sm">פרופיל דמו</div>
      <div className="emboss absolute inset-x-0 top-[22%] text-center font-display text-[5.5rem] leading-none font-bold">{n}</div>
      <div className="absolute inset-x-5 bottom-6 space-y-2.5" dir="rtl">
        <div className="h-3.5 w-1/2 rounded-full bg-fg/45" />
        <div className="h-2.5 w-2/3 rounded-full bg-fg/25" />
        <div className="h-2.5 w-1/3 rounded-full bg-fg/20" />
      </div>
      {stamp === 1 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute top-12 left-4 -rotate-[14deg] rounded-xl border-[3px] border-[#ff4d55] bg-black/20 px-3 py-1 text-2xl font-black text-[#ff6b70]"
        >
          אהבתי
        </motion.div>
      )}
      {stamp === -1 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute top-12 right-4 rotate-[14deg] rounded-xl border-[3px] border-white/80 bg-black/20 px-3 py-1 text-2xl font-black text-white"
        >
          לא הפעם
        </motion.div>
      )}
    </div>
  );
}

function SideArrow({ side, active }: { side: "left" | "right"; active: boolean }) {
  const Icon = side === "right" ? ArrowRight : ArrowLeft;
  return (
    <motion.div
      animate={active ? { opacity: 1, x: side === "right" ? [0, 8, 0] : [0, -8, 0] } : { opacity: 0.18, x: 0 }}
      transition={active ? { duration: 0.9, repeat: Infinity } : { duration: 0.3 }}
      className={`flex w-[17%] flex-col items-center gap-1 ${side === "right" ? "text-[#e5383b]" : "text-cream/70"}`}
    >
      <Icon size={34} strokeWidth={2.4} />
      <span className="text-[11px] font-semibold">{side === "right" ? "לייק" : "לא הפעם"}</span>
    </motion.div>
  );
}

function ButtonHint({ active, label, children }: { active: boolean; label: string; children: React.ReactNode }) {
  return (
    <motion.div animate={active ? { scale: [1, 1.12, 1], opacity: 1 } : { scale: 1, opacity: 0.55 }} transition={active ? { duration: 0.9, repeat: Infinity } : {}} className="flex flex-col items-center gap-1.5">
      {children}
      <span className="text-[11px] text-mute">{label}</span>
    </motion.div>
  );
}
