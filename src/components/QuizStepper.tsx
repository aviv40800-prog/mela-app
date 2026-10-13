"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Loader2, RotateCcw } from "lucide-react";
import { api, haptic } from "@/lib/client";
import { QUESTION_CATEGORIES, QUIZ_QUESTIONS } from "@/lib/content";

type Choice = "a" | "b";
type Question = { key: string; cat: string; a: string; b: string };

/** Onboarding questionnaire: one "this or that" card at a time, mixing heritage and everyday questions. */
export function QuizStepper({
  answers,
  onAnswer,
  questions = QUIZ_QUESTIONS,
  doneView,
}: {
  answers: Record<string, Choice> | null;
  onAnswer: (key: string, c: Choice) => void;
  questions?: readonly Question[];
  /** Replaces the default "finished" panel. */
  doneView?: React.ReactNode;
}) {
  const QUIZ = questions;
  const [idx, setIdx] = useState<number | null>(null);
  const [picked, setPicked] = useState<{ c: Choice; agree: number } | null>(null);
  const [busy, setBusy] = useState(false);

  // Start at the first unanswered question once answers load.
  useEffect(() => {
    if (answers && idx === null) {
      const first = QUIZ.findIndex((q) => !answers[q.key]);
      setIdx(first === -1 ? QUIZ.length : first);
    }
  }, [answers, idx]);

  if (!answers || idx === null)
    return (
      <div className="grid h-72 place-items-center">
        <Loader2 className="animate-spin text-gold" />
      </div>
    );

  const total = QUIZ.length;
  const done = QUIZ.filter((q) => answers[q.key]).length;
  const q = QUIZ[idx];

  async function choose(c: Choice) {
    if (!q || busy) return;
    setBusy(true);
    haptic(10);
    try {
      const { agreePercent } = await api<{ agreePercent: number }>("/api/quiz", { method: "POST", json: { questionKey: q.key, choice: c } });
      onAnswer(q.key, c);
      setPicked({ c, agree: agreePercent });
      setTimeout(() => {
        setPicked(null);
        setBusy(false);
        // next unanswered after this one, else the end
        const next = QUIZ.findIndex((x, i) => i > idx! && !answers![x.key] && x.key !== q.key);
        setIdx(next === -1 ? total : next);
      }, 900);
    } catch {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* progress dots */}
      <div className="mb-6 flex flex-wrap justify-center gap-1.5" aria-label={`${done} מתוך ${total}`}>
        {QUIZ.map((x, i) => (
          <button
            key={x.key}
            type="button"
            onClick={() => !busy && setIdx(i)}
            aria-label={`שאלה ${i + 1}`}
            className={`h-2 rounded-full transition-all duration-300 ${i === idx ? "w-6 bg-gold-2" : answers[x.key] ? "w-2 bg-gold/60" : "w-2 bg-fg/15"}`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {q ? (
          <motion.div
            key={q.key}
            initial={{ opacity: 0, x: -40, rotate: -2 }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            exit={{ opacity: 0, x: 40, rotate: 2 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
          >
            <div className="mb-4 flex items-center justify-between px-1">
              <span className={`rounded-full px-3 py-1 text-[11.5px] font-semibold ${q.cat === "culture" ? "bg-gold/15 text-gold-2" : "bg-fg/[0.07] text-cream/80"}`}>
                {QUESTION_CATEGORIES[q.cat] ?? q.cat}
              </span>
              <span className="tabular text-xs text-mute">
                {idx + 1}/{total}
              </span>
            </div>
            <div className="relative grid grid-cols-2 gap-3">
              {(["a", "b"] as const).map((side) => {
                const isPicked = picked?.c === side;
                const was = !picked && answers[q.key] === side;
                return (
                  <motion.button
                    key={side}
                    type="button"
                    disabled={busy}
                    whileTap={{ scale: 0.94 }}
                    animate={isPicked ? { scale: 1.04 } : picked ? { scale: 0.96, opacity: 0.4 } : { scale: 1, opacity: 1 }}
                    onClick={() => choose(side)}
                    className={`relative flex min-h-44 flex-col items-center justify-center rounded-[26px] p-4 text-center text-[18px] font-semibold transition-colors ${
                      isPicked || was ? "border border-gold/60 bg-gradient-to-b from-gold/20 to-gold/5 text-gold-2 shadow-[0_0_34px_-8px_rgba(184,137,43,0.6)]" : "surface"
                    }`}
                  >
                    {q[side]}
                    {isPicked && (
                      <motion.span initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-[11.5px] font-normal text-cream/80">
                        <span className="tabular">{picked!.agree}%</span> בחרו כמוך
                      </motion.span>
                    )}
                    {was && <Check size={16} className="absolute top-3 left-3" />}
                  </motion.button>
                );
              })}
              <span className="pointer-events-none absolute top-1/2 left-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-gold/40 bg-ink text-xs font-bold text-gold">
                או
              </span>
            </div>
            {idx > 0 && (
              <button type="button" onClick={() => !busy && setIdx(idx - 1)} className="mx-auto mt-5 flex items-center gap-1 text-sm text-mute transition hover:text-cream">
                <ArrowRight size={15} /> לשאלה הקודמת
              </button>
            )}
          </motion.div>
        ) : doneView ? (
          <motion.div key="done-custom" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            {doneView}
          </motion.div>
        ) : (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="surface rounded-[26px] p-8 text-center">
            <div className="text-4xl">🎉</div>
            <p className="mt-3 text-lg font-semibold">{done === total ? "סיימת את השאלון!" : `ענית על ${done} מתוך ${total}`}</p>
            <p className="mt-1 text-sm text-mute">{done === total ? "ההתאמות שלך כבר מחושבות לפי התשובות." : "נשארו כמה שאלות — לחצו על נקודה כדי לחזור אליהן."}</p>
            <button type="button" onClick={() => setIdx(0)} className="btn-ghost mt-5 text-sm">
              <RotateCcw size={14} /> לעבור שוב על התשובות
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
