"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { api, haptic } from "@/lib/client";
import { QUIZ_QUESTIONS } from "@/lib/content";
import { Skeleton } from "./ui/Skeleton";

/** "This or That" — quick cultural quiz. Answers feed the compatibility score. */
export function ThisOrThat() {
  const [answers, setAnswers] = useState<Record<string, "a" | "b"> | null>(null);
  const [idx, setIdx] = useState(0);
  const [result, setResult] = useState<{ choice: "a" | "b"; agree: number } | null>(null);

  useEffect(() => {
    api<{ answers: Record<string, "a" | "b"> }>("/api/quiz").then(({ answers }) => {
      setAnswers(answers);
      const first = QUIZ_QUESTIONS.findIndex((q) => !answers[q.key]);
      setIdx(first === -1 ? QUIZ_QUESTIONS.length : first);
    });
  }, []);

  const q = QUIZ_QUESTIONS[idx];

  async function choose(choice: "a" | "b") {
    if (!q || result) return;
    haptic(10);
    const { agreePercent } = await api<{ agreePercent: number }>("/api/quiz", { method: "POST", json: { questionKey: q.key, choice } });
    setAnswers((a) => ({ ...a, [q.key]: choice }));
    setResult({ choice, agree: agreePercent });
    setTimeout(() => {
      setResult(null);
      setIdx((i) => i + 1);
    }, 1500);
  }

  const answered = answers ? Object.keys(answers).length : 0;

  return (
    <section className="mt-10">
      <div className="hairline mb-8" />
      <div className="flex items-end justify-between px-1">
        <div>
          <p className="eyebrow">משפר את ההתאמות שלך</p>
          <h2 className="font-display mt-1 text-[1.65rem] font-bold">זה או זה?</h2>
        </div>
        <span className="tabular rounded-full bg-white/[0.05] px-2.5 py-1 text-xs text-gold-2" dir="ltr">
          {Math.min(answered, QUIZ_QUESTIONS.length)}/{QUIZ_QUESTIONS.length}
        </span>
      </div>
      <div className="mt-4 h-[3px] overflow-hidden rounded-full bg-white/[0.07]">
        <motion.div
          className="mr-0 ml-auto h-full rounded-full bg-gradient-to-l from-gold-3 to-gold shadow-[0_0_10px_rgba(229,193,88,0.7)]"
          animate={{ width: `${(answered / QUIZ_QUESTIONS.length) * 100}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>

      {!answers ? (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Skeleton className="h-40 !rounded-3xl" />
          <Skeleton className="h-40 !rounded-3xl" />
        </div>
      ) : q ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={q.key}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="relative mt-5 grid grid-cols-2 gap-3"
          >
            {(["a", "b"] as const).map((side) => {
              const picked = result?.choice === side;
              return (
                <motion.button
                  key={side}
                  whileTap={result ? undefined : { scale: 0.94 }}
                  animate={picked ? { scale: 1.03 } : result ? { scale: 0.97, opacity: 0.45 } : { scale: 1, opacity: 1 }}
                  onClick={() => choose(side)}
                  className={`relative flex min-h-40 flex-col items-center justify-center overflow-hidden rounded-3xl p-4 text-center text-[17px] font-semibold transition-colors ${
                    picked ? "border border-gold/60 bg-gradient-to-b from-gold/20 to-gold/5 text-gold-2 shadow-[0_0_34px_-8px_rgba(212,175,55,0.6)]" : "surface hover:border-line-2"
                  }`}
                >
                  {q[side]}
                  {picked && (
                    <motion.span initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 w-full">
                      <span className="block h-1 overflow-hidden rounded-full bg-black/30">
                        <motion.span
                          className="mr-0 ml-auto block h-full rounded-full bg-gold-2"
                          initial={{ width: 0 }}
                          animate={{ width: `${result.agree}%` }}
                          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        />
                      </span>
                      <span className="mt-1.5 block text-[11.5px] font-normal text-cream/80">
                        <span className="tabular">{result.agree}%</span> בחרו כמוך
                      </span>
                    </motion.span>
                  )}
                </motion.button>
              );
            })}
            <span className="pointer-events-none absolute top-1/2 left-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-gold/40 bg-ink text-xs font-bold text-gold shadow-[0_0_20px_-4px_rgba(212,175,55,0.5)]">
              או
            </span>
          </motion.div>
        </AnimatePresence>
      ) : (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="surface mt-5 rounded-3xl p-6 text-center">
          <p className="text-lg font-semibold">סיימת את החידון 🎉</p>
          <p className="mt-1 text-sm text-mute">ההתאמות שלך כבר מעודכנות.</p>
          <button onClick={() => setIdx(0)} className="btn-ghost mt-5 text-sm">
            <RotateCcw size={14} /> לשנות תשובות
          </button>
        </motion.div>
      )}
    </section>
  );
}
