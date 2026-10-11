"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { api, haptic } from "@/lib/client";
import { QUIZ_QUESTIONS } from "@/lib/content";

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
    haptic();
    const { agreePercent } = await api<{ agreePercent: number }>("/api/quiz", { method: "POST", json: { questionKey: q.key, choice } });
    setAnswers((a) => ({ ...a, [q.key]: choice }));
    setResult({ choice, agree: agreePercent });
    setTimeout(() => {
      setResult(null);
      setIdx((i) => i + 1);
    }, 1400);
  }

  const answered = answers ? Object.keys(answers).length : 0;

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between px-1">
        <div>
          <h2 className="font-display text-2xl font-bold">זה או זה?</h2>
          <p className="mt-1 text-sm text-mute">כל תשובה משפרת את ההתאמות שלך</p>
        </div>
        <span className="text-xs text-gold-2" dir="ltr">
          {Math.min(answered, QUIZ_QUESTIONS.length)}/{QUIZ_QUESTIONS.length}
        </span>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-l from-gold-2 to-gold transition-all duration-500" style={{ width: `${(answered / QUIZ_QUESTIONS.length) * 100}%` }} />
      </div>

      {!answers ? (
        <div className="glass mt-4 h-40 animate-pulse rounded-3xl" />
      ) : q ? (
        <div key={q.key} className="animate-rise relative mt-4 grid grid-cols-2 gap-3">
          {(["a", "b"] as const).map((side) => {
            const picked = result?.choice === side;
            return (
              <button
                key={side}
                onClick={() => choose(side)}
                className={`relative flex min-h-36 flex-col items-center justify-center rounded-3xl p-4 text-center text-lg font-semibold transition-all duration-300 ${
                  picked ? "glow scale-[1.03] bg-gold/15 text-gold-2" : result ? "glass opacity-40" : "glass hover:bg-white/[0.06] active:scale-95"
                }`}
              >
                {q[side]}
                {picked && <span className="animate-rise mt-2 text-xs font-normal text-cream/80">{result.agree}% בחרו כמוך</span>}
              </button>
            );
          })}
          <span className="absolute top-1/2 left-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-gold/40 bg-ink text-xs font-bold text-gold">
            או
          </span>
        </div>
      ) : (
        <div className="glass mt-4 rounded-3xl p-6 text-center">
          <p className="font-semibold">סיימת את החידון 🎉</p>
          <p className="mt-1 text-sm text-mute">ההתאמות שלך כבר מעודכנות.</p>
          <button onClick={() => setIdx(0)} className="btn-ghost mt-4 text-sm">
            <RotateCcw size={14} /> לשנות תשובות
          </button>
        </div>
      )}
    </section>
  );
}
