"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, PenLine, X } from "lucide-react";
import { api } from "@/lib/client";
import { QuizStepper } from "./QuizStepper";

type Q = { key: string; cat: string; a: string; b: string };
type Checkin = { questions: Q[]; nextAt: string | null; answered: number; total: number };

function inDays(iso: string) {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return d <= 1 ? "מחר" : `בעוד ${d} ימים`;
}

/** "Improve your profile": a few smart questions every few days that sharpen matches. */
export function ImproveProfile() {
  const router = useRouter();
  const [c, setC] = useState<Checkin | null>(null);
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, "a" | "b">>({});

  const load = () => api<Checkin>("/api/checkin").then(setC).catch(() => {});
  useEffect(() => {
    void load();
  }, []);

  if (!c) return <div className="skeleton h-[120px] rounded-[24px]" />;
  const available = c.questions.length > 0;
  const pct = Math.round((c.answered / c.total) * 100);

  return (
    <>
      <div className={`relative isolate overflow-hidden rounded-[24px] p-5 ${available ? "border border-gold/35" : "surface"}`}>
        {available && <div className="absolute inset-0 -z-10 bg-[radial-gradient(100%_100%_at_100%_0%,rgba(180,87,58,0.2),transparent_60%),linear-gradient(180deg,var(--color-ink-3),var(--color-ink-2))]" />}
        <div className="flex items-start gap-3.5">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${available ? "bg-gradient-to-b from-gold-3 to-gold text-ink" : "border border-gold/20 bg-gold/[0.07] text-gold-2"}`}>
            <PenLine size={18} />
          </span>
          <div className="flex-1">
            <div className="text-[15px] font-semibold">{available ? `${c.questions.length} שאלות חדשות מחכות לך` : "שיפור הפרופיל"}</div>
            <p className="mt-0.5 text-[12.5px] text-mute">
              {available
                ? "רוצה לשפר קצת את הפרופיל? כל תשובה מחדדת את ההתאמות שלך."
                : c.nextAt
                  ? `השאלות הבאות יגיעו ${inDays(c.nextAt)}.`
                  : "ענית על כל השאלות — הפרופיל שלך מלא 🎉"}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-[11.5px] text-mute">
            <span>עד כמה אנחנו מכירים אותך</span>
            <span className="tabular" dir="ltr">
              {c.answered}/{c.total}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-fg/[0.07]">
            <motion.div className="h-full rounded-full bg-gradient-to-l from-gold-3 to-gold" initial={false} animate={{ width: `${pct}%` }} />
          </div>
        </div>
        {available && (
          <button onClick={() => setOpen(true)} className="btn-gold mt-4 w-full py-3 text-sm">
            בואו נתחיל · פחות מדקה
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && c && (
          <motion.div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-[6px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              onClick={(e) => e.stopPropagation()}
              className="surface mx-auto w-full max-w-md rounded-t-[34px] px-6 pt-3 safe-bottom"
              role="dialog"
              aria-label="שיפור הפרופיל"
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-fg/20" />
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-semibold">בואו נכיר אותך עוד קצת</h2>
                <button onClick={() => setOpen(false)} className="text-mute transition hover:text-cream" aria-label="סגירה">
                  <X size={20} />
                </button>
              </div>
              <div className="pb-4">
                <QuizStepper
                  questions={c.questions}
                  answers={answers}
                  onAnswer={(k, v) => setAnswers((a) => ({ ...a, [k]: v }))}
                  doneView={
                    <div className="py-8 text-center">
                      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold-2"><Check size={26} /></div>
                      <p className="mt-3 text-lg font-semibold">ההתאמות שלך עודכנו</p>
                      <p className="mt-1 text-sm text-mute">שאלות חדשות יגיעו בעוד כמה ימים.</p>
                      <button
                        onClick={() => {
                          setOpen(false);
                          setAnswers({});
                          void load();
                          router.refresh();
                        }}
                        className="btn-gold mt-6 w-full"
                      >
                        מעולה
                      </button>
                    </div>
                  }
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
