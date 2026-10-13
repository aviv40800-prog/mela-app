"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Target, X } from "lucide-react";
import { haptic } from "@/lib/client";
import { QuizStepper } from "./QuizStepper";

type Question = { key: string; cat: string; a: string; b: string };

const OFF_KEY = "mela:quiz-offer-off";
const COUNT_KEY = "mela:swipes-since-offer";
/** Offer three more questions after this many swipes. */
export const OFFER_EVERY = 8;

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

/** Counts a swipe; true when it's time to offer more questions (and the member hasn't opted out). */
export function countSwipeForOffer(): boolean {
  if (store.get(OFF_KEY) === "1") return false;
  const n = Number(store.get(COUNT_KEY) ?? 0) + 1;
  store.set(COUNT_KEY, String(n));
  return n >= OFFER_EVERY;
}
const resetCount = () => store.set(COUNT_KEY, "0");

/**
 * "3 more questions for better matches" — offered between swipes. Entirely optional: "not now" waits
 * another OFFER_EVERY swipes, "don't offer again" stops it (more questions stay available in the profile).
 */
export function QuizOfferSheet({ questions, onClose, onAnswered }: { questions: Question[]; onClose: () => void; onAnswered: () => void }) {
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, "a" | "b">>({});
  const answeredAny = Object.keys(answers).length > 0;

  const close = () => {
    resetCount();
    if (answeredAny) onAnswered();
    onClose();
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-[6px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        onClick={(e) => e.stopPropagation()}
        className="surface mx-auto w-full max-w-md rounded-t-[34px] px-6 pt-3 safe-bottom"
        role="dialog"
        aria-label="שאלות להתאמה מדויקת יותר"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-fg/20" />
        <button onClick={close} className="absolute top-5 left-5 text-mute transition hover:text-cream" aria-label="סגירה">
          <X size={20} />
        </button>

        {!started ? (
          <div className="pb-2 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold-2">
              <Target size={28} strokeWidth={1.6} />
            </div>
            <h2 className="font-display mt-5 text-[1.6rem] leading-tight font-bold">רוצה התאמות מדויקות יותר?</h2>
            <p className="mx-auto mt-2 max-w-xs text-[14.5px] leading-relaxed text-mute">3 שאלות קצרות של &quot;זה או זה&quot; — פחות מדקה, וכל תשובה מחדדת את מי שנראה לך.</p>
            <button
              onClick={() => {
                haptic(10);
                setStarted(true);
              }}
              className="btn-gold mt-7 w-full"
            >
              יאללה, 3 שאלות
            </button>
            <button onClick={close} className="btn-ghost mt-3 w-full">
              לא עכשיו
            </button>
            <button
              onClick={() => {
                store.set(OFF_KEY, "1");
                onClose();
              }}
              className="mt-4 mb-2 text-[13px] text-mute-2 underline-offset-4 transition hover:text-cream hover:underline"
            >
              אל תציעו לי שוב
            </button>
          </div>
        ) : (
          <div className="pb-4">
            <QuizStepper
              questions={questions}
              answers={answers}
              onAnswer={(k, v) => setAnswers((a) => ({ ...a, [k]: v }))}
              doneView={
                <div className="py-6 text-center">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold-2">
                    <Check size={26} />
                  </div>
                  <p className="mt-3 text-lg font-semibold">ההתאמות שלך עודכנו</p>
                  <p className="mt-1 text-sm text-mute">נציע עוד כמה שאלות בהמשך הדרך.</p>
                  <button onClick={close} className="btn-gold mt-6 w-full">
                    חזרה לגילוי
                  </button>
                </div>
              }
            />
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
