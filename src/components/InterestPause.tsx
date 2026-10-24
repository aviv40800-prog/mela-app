"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lock, PenLine } from "lucide-react";
import { api, haptic } from "@/lib/client";
import { QUESTION_CATEGORIES } from "@/lib/content";

type Question = { key: string; cat: string; a: string; b: string; title?: string };
/** `featured`: the question of the week, popped on opening the app — not between swipes. */
export type Pause = { kind: "quiz"; questions: Question[]; featured?: boolean } | { kind: "community" };

const OFF_KEY = "mela:quiz-offer-off";
const COUNT_KEY = "mela:swipes-since-offer";
const PAUSES_KEY = "mela:pauses";
/** A pause comes every this many swipes; every COMMUNITY_EVERY-th pause asks for a community question instead. */
export const OFFER_EVERY = 8;
export const COMMUNITY_EVERY = 3;

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

/** Counts a swipe; true when it's time for a pause (and the member hasn't turned pauses off). */
export function countSwipeForOffer(): boolean {
  if (store.get(OFF_KEY) === "1") return false;
  const n = Number(store.get(COUNT_KEY) ?? 0) + 1;
  store.set(COUNT_KEY, String(n));
  return n >= OFFER_EVERY;
}
/** Starts a pause: resets the swipe counter and says whether this one is the community question. */
export function startPause(): { community: boolean } {
  store.set(COUNT_KEY, "0");
  const n = Number(store.get(PAUSES_KEY) ?? 0) + 1;
  store.set(PAUSES_KEY, String(n));
  return { community: n % COMMUNITY_EVERY === 0 };
}

const swap = {
  initial: { opacity: 0, y: 14, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -10, filter: "blur(4px)" },
  transition: { duration: 0.28, ease: [0.2, 0.7, 0.2, 1] as const },
};

/**
 * "A moment of interest" between swipes: one light question at a time (two-choice, or a free answer),
 * a clear "skip" everywhere, and after each answer the member picks: back to swiping or one more.
 * Every third pause asks instead what *they* would ask the other side — feeding the community question pool.
 */
export function InterestPause({ pause, onClose }: { pause: Pause; onClose: (answered: boolean) => void }) {
  const [answered, setAnswered] = useState(false);
  const close = () => onClose(answered);

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end bg-black/55" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
      <motion.section
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 36 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        onDragEnd={(_, i) => (i.offset.y > 110 || i.velocity.y > 600) && close()}
        onClick={(e) => e.stopPropagation()}
        className="relative mx-auto w-full max-w-md rounded-t-[32px] border-t border-gold/45 bg-gradient-to-b from-ink-3 to-ink-2 px-5 pt-3 shadow-[0_-20px_60px_rgb(0_0_0/0.5),0_-1px_40px_rgb(245_196_106/0.12)] safe-bottom"
        role="dialog"
        aria-label={pause.kind === "community" ? "שאלה מהקהילה" : "רגע של עניין"}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-fg/20" />
        {pause.kind === "quiz" ? (
          <QuizPause questions={pause.questions} featured={pause.featured} onAnswered={() => setAnswered(true)} onClose={close} />
        ) : (
          <CommunityPause onClose={close} />
        )}
      </motion.section>
    </motion.div>
  );
}

function PauseHeader({ label, onSkip }: { label: string; onSkip: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-[13px] text-gold-3">
        <svg width="20" height="18" viewBox="0 0 240 216" aria-hidden="true">
          <path d="M120 212 C48 160 4 116 4 66 C4 30 32 4 66 4 C92 4 110 18 120 38 C130 18 148 4 174 4 C208 4 236 30 236 66 C236 116 192 160 120 212 Z" fill="rgb(229 56 59 / 0.25)" stroke="#ff5a63" strokeWidth="16" />
        </svg>
        {label}
      </span>
      <button onClick={onSkip} className="press min-h-10 rounded-full border border-fg/20 bg-fg/5 px-4 text-sm text-cream/90">
        דלג
      </button>
    </div>
  );
}

function Saved({ title, line, children }: { title: string; line: string; children: React.ReactNode }) {
  return (
    <motion.div key="saved" {...swap} className="flex flex-col items-center gap-4 pt-2 pb-2 text-center">
      <div className="grid h-[76px] w-[76px] place-items-center rounded-full border border-gold/50 bg-[radial-gradient(circle,rgb(245_196_106/0.3),rgb(245_196_106/0.05)_70%)]">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#f5c46a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <motion.path d="M5 12l5 5 9-10" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.15 }} />
        </svg>
      </div>
      <h2 className="font-display text-[1.6rem] font-bold">{title}</h2>
      <p className="max-w-[300px] text-[15px] leading-relaxed text-mute">{line}</p>
      <div className="mt-1 flex w-full flex-col gap-2.5">{children}</div>
    </motion.div>
  );
}

function QuizPause({ questions, featured, onAnswered, onClose }: { questions: Question[]; featured?: boolean; onAnswered: () => void; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"ask" | "write" | "saved">("ask");
  const [picked, setPicked] = useState<"a" | "b" | null>(null);
  const [text, setText] = useState("");
  const [agree, setAgree] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const q = questions[idx];
  const left = questions.length - idx - 1;

  async function send(body: { choice: "a" | "b" } | { text: string }) {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ agreePercent: number | null }>("/api/quiz", { method: "POST", json: { questionKey: q.key, ...body } });
      setAgree(r.agreePercent);
      onAnswered();
      haptic([8, 30, 12]);
      setTimeout(() => setPhase("saved"), "choice" in body ? 380 : 0);
    } catch (e) {
      setErr((e as Error).message);
      setPicked(null);
    } finally {
      setBusy(false);
    }
  }

  function next() {
    setIdx((i) => i + 1);
    setPhase("ask");
    setPicked(null);
    setText("");
    setAgree(null);
  }

  return (
    <div className="flex min-h-[420px] flex-col gap-4 pb-3">
      <PauseHeader label={featured ? "שאלת השבת" : `רגע של עניין · ${idx + 1} מתוך ${questions.length}`} onSkip={onClose} />
      <AnimatePresence mode="wait" initial={false}>
        {phase === "saved" ? (
          <Saved
            title="נשמר, תודה"
            line={agree !== null ? `${agree}% מהקהילה ענו כמוך. מעכשיו נתחשב בזה כשנציע לך אנשים.` : "התשובה נשמרה ותעזור לנו להכיר אותך טוב יותר."}
          >
            <button onClick={onClose} className="btn-gold w-full">
              {featured ? "סגירה" : "חזרה לסווייפים"}
            </button>
            {left > 0 && (
              <button onClick={next} className="btn-ghost w-full">
                עוד שאלה ({left} {left === 1 ? "נשארה" : "נשארו"})
              </button>
            )}
          </Saved>
        ) : phase === "write" ? (
          <motion.div key={`w-${idx}`} {...swap} className="flex flex-col gap-3">
            <h2 className="font-display text-[1.45rem] leading-snug font-bold">
              {q.a} או {q.b}? ספר/י במילים שלך
            </h2>
            <label htmlFor="pause-own" className="sr-only">
              התשובה שלך
            </label>
            <textarea id="pause-own" value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={200} autoFocus placeholder="למשל: תלוי ביום — אבל בשישי תמיד…" className="field resize-none text-[15px] leading-relaxed" />
            {err && <p className="text-sm text-danger">{err}</p>}
            <button onClick={() => send({ text })} disabled={busy || text.trim().length < 2} className="btn-gold w-full">
              שמירה
            </button>
            <button onClick={() => setPhase("ask")} className="text-sm text-mute transition hover:text-cream">
              חזרה לבחירה
            </button>
          </motion.div>
        ) : (
          <motion.div key={`q-${idx}`} {...swap} className="flex flex-col gap-3">
            <span className="w-fit rounded-full bg-gold/12 px-3 py-1 text-[11.5px] font-semibold text-gold-2">{QUESTION_CATEGORIES[q.cat] ?? q.cat}</span>
            <h2 className="font-display text-[1.65rem] leading-tight font-bold">{q.title ?? "מה יותר את/ה?"}</h2>
            <div role="radiogroup" aria-label="תשובות" className="flex flex-col gap-2.5">
              {(["a", "b"] as const).map((k, n) => {
                const on = picked === k;
                return (
                  <motion.button
                    key={k}
                    role="radio"
                    aria-checked={on}
                    whileTap={{ scale: 0.97 }}
                    disabled={busy}
                    onClick={() => {
                      setPicked(k);
                      void send({ choice: k });
                    }}
                    animate={picked && !on ? { opacity: 0.45 } : { opacity: 1 }}
                    className={`flex min-h-[58px] items-center gap-3 rounded-[18px] border px-4 text-start text-[16px] transition-colors ${
                      on ? "border-gold bg-gold/15 font-medium text-[#fff4dc] shadow-[0_0_24px_rgb(245_196_106/0.2)]" : "border-gold/25 bg-fg/[0.04] hover:border-gold/50"
                    }`}
                  >
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-[13px] font-bold ${on ? "bg-gold text-[#2a0a0c]" : "bg-gold/12 text-gold-2"}`}>
                      {on ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 12l5 5 9-10" />
                        </svg>
                      ) : n === 0 ? (
                        "א"
                      ) : (
                        "ב"
                      )}
                    </span>
                    {q[k]}
                  </motion.button>
                );
              })}
            </div>
            {err && <p className="text-sm text-danger">{err}</p>}
            <button onClick={() => setPhase("write")} className="flex min-h-11 w-fit items-center gap-1.5 text-[14.5px] text-gold-2">
              <PenLine size={15} /> או לכתוב תשובה משלך
            </button>
            {!featured && (
            <button
              onClick={() => {
                store.set(OFF_KEY, "1");
                onClose();
              }}
              className="mt-1 text-center text-[12.5px] text-mute-2 underline-offset-4 transition hover:text-cream hover:underline"
            >
              לא להציג הפוגות שאלות יותר
            </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CommunityPause({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [inspiration, setInspiration] = useState<string[]>([]);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api<{ inspiration: string[] }>("/api/community-questions")
      .then((r) => setInspiration(r.inspiration.slice(0, 3)))
      .catch(() => {});
  }, []);

  async function send() {
    setBusy(true);
    setErr(null);
    try {
      await api("/api/community-questions", { method: "POST", json: { text } });
      haptic([8, 30, 12]);
      setSent(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[420px] flex-col gap-4 pb-3">
      <PauseHeader label="שאלה מהקהילה" onSkip={onClose} />
      <AnimatePresence mode="wait" initial={false}>
        {sent ? (
          <Saved title="תודה ששיתפת" line="אחרי בדיקה קצרה השאלה תצטרף למאגר, ואולי תפתח את השיחה הבאה של מישהו.">
            <button onClick={onClose} className="btn-gold w-full">
              חזרה לסווייפים
            </button>
          </Saved>
        ) : (
          <motion.div key="ask" {...swap} className="flex flex-col gap-3">
            <h2 className="font-display text-[1.5rem] leading-snug font-bold">אם היית יכול/ה לשאול את הצד השני רק שאלה אחת — מה היית שואל/ת?</h2>
            <label htmlFor="community-q" className="text-[13px] text-mute">
              השאלה שלך
            </label>
            <textarea
              id="community-q"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={160}
              placeholder="למשל: מה המאכל של סבתא שהכי חסר לך?"
              className="field -mt-2 resize-none text-[15px] leading-relaxed"
            />
            {inspiration.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[12.5px] text-mute-2">השראה משאלות של אחרים</span>
                <div className="flex flex-wrap gap-1.5">
                  {inspiration.map((t) => (
                    <span key={t} className="rounded-full border border-gold/25 px-3 py-1.5 text-[13px] text-cream/85">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-mute">
              <Lock size={14} className="mt-0.5 shrink-0 text-gold-2" />
              השאלה נכנסת בעילום שם למאגר של MELA, ואחרי בדיקה עשויה להופיע כ״רעיון לשאלה״ בשיחות של אחרים.
            </p>
            {err && <p className="text-sm text-danger">{err}</p>}
            <button onClick={send} disabled={busy || text.trim().length < 8} className="btn-gold w-full">
              שליחה לקהילה
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
