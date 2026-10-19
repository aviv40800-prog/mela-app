"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Camera, Check, Copy, Feather, Gift, Heart, RotateCcw, Share2, Sparkles, Sprout } from "lucide-react";
import { api, haptic, track } from "@/lib/client";
import { Photo } from "./Photo";
import { shareInvite, type Quota } from "./LikeLimitSheet";
import type { MiniProfile } from "./MatchModal";
import type { Candidate } from "@/lib/types";

type Question = { key: string; cat: string; a: string; b: string };
type Step = "boost" | "chat" | "second" | "invite" | "waiting";
type Referral = { link: string; joined: number; earned: number; bonus: number; max: number };
type Tip = { href: string; icon: React.ReactNode; title: string; line: string };

const STORE_KEY = "mela:journey";
const israelDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());

/** Where the member got to today, so coming back later doesn't start the whole path over. */
const journey = {
  get(): Step | null {
    try {
      const v = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null") as { day: string; step: Step } | null;
      return v?.day === israelDay() ? v.step : null;
    } catch {
      return null;
    }
  },
  set(step: Step) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ day: israelDay(), step }));
    } catch {}
  },
};

/** Called by the deck when the second-chance cards run out: the path continues from the invite. */
export const continueJourneyAtInvite = () => journey.set("invite");

const swap = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.3, ease: [0.2, 0.7, 0.2, 1] as const },
};

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

/**
 * What a member sees once today's profiles run out — never a dead end, but a short path:
 * 1. improve your chances (a 2–3 minute chat with MELA that sharpens the matching),
 * 2. a second chance for passed profiles the new answers now rate higher,
 * 3. invite friends — 10 likes for every friend who joins,
 * 4. "your next match is on its way" (countdown to tomorrow's picks + an email when someone who fits joins).
 */
export function DeckJourney({
  fresh,
  quota,
  me,
  onSecondChance,
  onRefresh,
}: {
  fresh: boolean;
  quota: Quota | null;
  me: MiniProfile;
  onSecondChance: (cards: Candidate[]) => void;
  onRefresh: () => void;
}) {
  const [step, setStepState] = useState<Step | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [tips, setTips] = useState<Tip[]>([]);
  const baseline = useRef<Map<number, number> | null>(null);

  const setStep = useCallback((s: Step) => {
    journey.set(s);
    setStepState(s);
  }, []);

  useEffect(() => {
    const saved = journey.get();
    // Scores before the chat, to tell which passed profiles the new answers moved up.
    api<{ candidates: Candidate[] }>("/api/second-chance")
      .then((r) => (baseline.current = new Map(r.candidates.map((c) => [c.id, c.compatibility]))))
      .catch(() => {});
    if (saved && saved !== "boost" && saved !== "chat") return void setStepState(saved);
    Promise.all([
      api<{ questions: Question[] }>("/api/quiz/next?n=8").catch(() => ({ questions: [] })),
      api<{ user: { photos: string[]; bio: string | null } }>("/api/me").catch(() => null),
    ]).then(([q, mine]) => {
      const t: Tip[] = [];
      if (mine && !mine.user.photos.length)
        t.push({ href: "/onboarding/profile?edit=1&step=photos", icon: <Camera size={17} />, title: "הוספת תמונה", line: "פרופיל עם תמונה מקבל הרבה יותר לייקים" });
      if (mine && (mine.user.bio ?? "").trim().length < 60)
        t.push({ href: "/onboarding/profile?edit=1&step=about", icon: <Feather size={17} />, title: "עוד כמה מילים עלייך", line: "ביו אישי ומלא עוזר לאחרים להתחבר אלייך" });
      setTips(t);
      setQuestions(q.questions);
      // Nothing to sharpen and nothing to add? Straight on to the second chance.
      if (!q.questions.length && !t.length) setStep("second");
      else setStepState("boost");
    });
  }, [setStep]);

  if (!step) return <Shell><div className="skeleton h-40 w-full rounded-[28px]" /></Shell>;

  return (
    <Shell>
      <AnimatePresence mode="wait">
        {step === "boost" && (
          <Boost key="boost" fresh={fresh} tips={tips} hasChat={!!questions?.length} onChat={() => setStep("chat")} onSkip={() => setStep("second")} />
        )}
        {step === "chat" && questions && (
          <MelaChat
            key="chat"
            name={firstName(me.name)}
            questions={questions}
            onDone={(answered) => {
              track("mela_chat_done", { answered });
              setStep("second");
            }}
          />
        )}
        {step === "second" && (
          <SecondChance
            key="second"
            baseline={baseline.current}
            onStart={(cards) => {
              track("second_chance_start", { count: cards.length });
              journey.set("invite");
              onSecondChance(cards);
            }}
            onSkip={() => setStep("invite")}
          />
        )}
        {step === "invite" && <Invite key="invite" premium={!!quota?.premium} onNext={() => setStep("waiting")} />}
        {step === "waiting" && (
          <Waiting key="waiting" fresh={fresh} resetsAt={quota?.resetsAt ?? null} onRefresh={onRefresh} onInvite={() => setStep("invite")} />
        )}
      </AnimatePresence>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="flex h-[calc(100dvh-196px)] flex-col justify-center px-5">{children}</div>;
}

function Halo({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto mb-6">
      <div className="absolute inset-0 animate-pulse-ring rounded-full" />
      <div className="glow grid h-20 w-20 place-items-center rounded-full bg-gradient-to-b from-gold/20 to-gold/5 text-gold">{children}</div>
    </div>
  );
}

function Boost({ fresh, tips, hasChat, onChat, onSkip }: { fresh: boolean; tips: Tip[]; hasChat: boolean; onChat: () => void; onSkip: () => void }) {
  return (
    <motion.div {...swap} className="flex flex-col items-center text-center">
      <Halo>{fresh ? <Sprout size={30} strokeWidth={1.5} /> : <Sparkles size={30} strokeWidth={1.5} />}</Halo>
      <h2 className="font-display text-[1.7rem] font-bold">שפר/י את הסיכויים שלך</h2>
      <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-mute">
        {fresh
          ? "הקהילה של MELA רק מתחילה, ובינתיים אפשר להכין את הקרקע: ככל שנכיר אותך טוב יותר, ההתאמות שיגיעו יהיו מדויקות יותר."
          : "ראית את כל הפרופילים להיום. בוא/י ננצל את הרגע כדי לחדד את ההתאמות שלך."}
      </p>
      {tips.length > 0 && (
        <div className="mt-6 flex w-full flex-col gap-2">
          {tips.map((t) => (
            <Link key={t.href} href={t.href} className="surface press flex items-center gap-3 rounded-2xl px-4 py-3 text-start">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/[0.08] text-gold-2">{t.icon}</span>
              <span className="flex-1">
                <span className="block text-[14px] font-semibold">{t.title}</span>
                <span className="block text-[12px] text-mute">{t.line}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
      <div className="mt-7 flex w-full flex-col gap-3">
        {hasChat && (
          <button onClick={onChat} className="btn-gold">
            <Sparkles size={17} /> שיחה קצרה עם MELA · 2–3 דקות
          </button>
        )}
        <button onClick={onSkip} className="btn-ghost">
          {hasChat ? "אולי אחר כך" : "המשך"}
        </button>
      </div>
    </motion.div>
  );
}

type Msg = { id: number; from: "mela" | "me"; text: string };

const LEADS = ["נתחיל במשהו קליל:", "ומה לגבי זה?", "הבאה:", "שאלה מהלב:", "ועכשיו?", "עוד אחת:", "כמעט סיימנו:", "ואחרונה:"];
const REACTIONS = ["רשמתי ✍️", "מעניין! זה עוזר לי מאוד", "אהבתי 🙂", "תודה, זה מחדד לי את התמונה", "מעולה", "יפה, ממשיכים"];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A short scripted conversation with MELA: this-or-that questions, one at a time, each answer saved as it comes. */
function MelaChat({ name, questions, onDone }: { name: string; questions: Question[]; onDone: (answered: number) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [asking, setAsking] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const answered = useRef(0);
  // Each run of the script gets a number; a newer run (or unmounting) silently stops the older one.
  const run = useRef(0);
  const nextId = useRef(0);
  const list = useRef<HTMLDivElement>(null);

  const say = useCallback(async (g: number, ...texts: string[]) => {
    for (const text of texts) {
      setTyping(true);
      await wait(550 + Math.min(900, text.length * 18));
      if (g !== run.current) return false;
      setTyping(false);
      setMsgs((m) => [...m, { id: nextId.current++, from: "mela", text }]);
      await wait(250);
    }
    return g === run.current;
  }, []);

  const ask = useCallback(
    async (g: number, i: number) => {
      if (i >= questions.length) {
        if (await say(g, `תודה${name ? ` ${name}` : ""}! עדכנתי את ההתאמות שלך ✨`, "בוא/י נראה מה השתנה.")) setFinished(true);
        return;
      }
      const q = questions[i];
      if (await say(g, `${LEADS[Math.min(i, LEADS.length - 1)]} ${q.a} או ${q.b}?`)) setAsking(i);
    },
    [questions, name, say],
  );

  useEffect(() => {
    const g = ++run.current;
    setMsgs([]);
    void (async () => {
      if (await say(g, `היי${name ? ` ${name}` : ""}! אני MELA, השדכנית שלך 🤎`, "יש לי כמה שאלות קצרות כדי להכיר אותך קצת יותר לעומק. פשוט בוחרים מה מתאים לך יותר."))
        await ask(g, 0);
    })();
    return () => {
      run.current++;
    };
  }, [say, ask, name]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing, asking, finished]);

  async function answer(i: number, choice: "a" | "b" | null) {
    const q = questions[i];
    setAsking(null);
    haptic(8);
    setMsgs((m) => [...m, { id: nextId.current++, from: "me", text: choice ? q[choice] : "דילוג" }]);
    let reaction = "אין בעיה, נמשיך";
    if (choice) {
      const r = await api<{ agreePercent: number | null }>("/api/quiz", { method: "POST", json: { questionKey: q.key, choice } }).catch(() => null);
      answered.current += 1;
      reaction = r?.agreePercent != null && r.agreePercent >= 50 && i % 2 === 0 ? `${r.agreePercent}% מהקהילה ענו כמוך 🙂` : REACTIONS[i % REACTIONS.length];
    }
    const g = run.current;
    if (await say(g, reaction)) await ask(g, i + 1);
  }

  const q = asking !== null ? questions[asking] : null;
  return (
    <motion.div {...swap} className="surface flex h-full flex-col overflow-hidden rounded-[28px]">
      <div className="flex items-center gap-3 border-b border-fg/10 px-4 py-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-b from-gold-3 to-gold text-[#2a1c12]">
          <Heart size={16} className="fill-current" />
        </span>
        <div className="flex-1">
          <div className="text-[14px] font-semibold">MELA</div>
          <div className="text-[11.5px] text-mute">השדכנית שלך · {Math.min(answered.current, questions.length)}/{questions.length}</div>
        </div>
        {!finished && (
          <button onClick={() => onDone(answered.current)} className="press rounded-full border border-fg/15 px-3 py-1.5 text-[12px] text-cream/80">
            סיום
          </button>
        )}
      </div>
      <div ref={list} className="no-scrollbar flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
        {msgs.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[14.5px] leading-relaxed ${
              m.from === "mela" ? "self-start rounded-ss-md bg-fg/[0.07]" : "self-end rounded-se-md bg-gradient-to-b from-gold-3 to-gold text-[#2a1c12]"
            }`}
          >
            {m.text}
          </motion.div>
        ))}
        {typing && (
          <div className="flex gap-1 self-start rounded-2xl rounded-ss-md bg-fg/[0.07] px-4 py-3" aria-label="MELA מקלידה">
            {[0, 1, 2].map((d) => (
              <motion.span key={d} className="h-1.5 w-1.5 rounded-full bg-cream/60" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.18 }} />
            ))}
          </div>
        )}
      </div>
      <div className="border-t border-fg/10 px-4 py-3">
        {q && asking !== null ? (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              {(["a", "b"] as const).map((c) => (
                <button key={c} onClick={() => answer(asking, c)} className="press rounded-2xl border border-gold/35 bg-gold/[0.08] px-3 py-3 text-[14px] font-medium">
                  {q[c]}
                </button>
              ))}
            </div>
            <button onClick={() => answer(asking, null)} className="text-[12.5px] text-mute">
              לדלג על השאלה
            </button>
          </div>
        ) : finished ? (
          <button onClick={() => onDone(answered.current)} className="btn-gold w-full">
            <Sparkles size={17} /> בוא/י נראה מה השתנה
          </button>
        ) : (
          <div className="h-[46px]" />
        )}
      </div>
    </motion.div>
  );
}

function SecondChance({ baseline, onStart, onSkip }: { baseline: Map<number, number> | null; onStart: (c: Candidate[]) => void; onSkip: () => void }) {
  const [cards, setCards] = useState<(Candidate & { delta: number })[] | null>(null);
  const skip = useRef(onSkip);
  useEffect(() => {
    skip.current = onSkip;
  });

  useEffect(() => {
    api<{ candidates: Candidate[] }>("/api/second-chance")
      .then(({ candidates }) => {
        const scored = candidates.map((c) => ({ ...c, delta: baseline?.has(c.id) ? c.compatibility - baseline.get(c.id)! : 0 }));
        // Prefer the profiles the new answers moved up; otherwise the strongest matches among the passed ones.
        const up = scored.filter((c) => c.delta > 0);
        const pick = (up.length ? up : scored.filter((c) => c.compatibility >= 80)).slice(0, 8);
        if (!pick.length) skip.current();
        else setCards(pick);
      })
      .catch(() => skip.current());
  }, [baseline]);

  if (!cards) return <motion.div key="loading" {...swap} className="skeleton mx-auto h-40 w-full rounded-[28px]" />;
  const n = cards.length;
  return (
    <motion.div {...swap} className="flex flex-col items-center text-center">
      <Halo>
        <RotateCcw size={28} strokeWidth={1.5} />
      </Halo>
      <h2 className="font-display text-[1.7rem] font-bold">הזדמנות שנייה 💫</h2>
      <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-mute">
        {cards.some((c) => c.delta > 0)
          ? `בזכות התשובות שלך מצאתי ${n === 1 ? "פרופיל אחד" : `${n} פרופילים`} שדילגת עליהם, ועכשיו ההתאמה ביניכם גבוהה יותר.`
          : `${n === 1 ? "יש פרופיל אחד" : `יש ${n} פרופילים`} שדילגת עליהם, עם התאמה גבוהה במיוחד אלייך. אולי שווה מבט נוסף?`}
      </p>
      <div className="mt-6 flex justify-center -space-x-3" dir="ltr">
        {cards.slice(0, 5).map((c) => (
          <div key={c.id} className="relative">
            <Photo src={c.photos[0]} name={c.full_name} rounded="rounded-full" className="h-14 w-14 border-2 border-ink" />
            <span className="tabular absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-gold px-1.5 text-[10.5px] font-bold text-[#2a1c12]">
              {c.delta > 0 ? `+${c.delta}%` : `${c.compatibility}%`}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-8 flex w-full flex-col gap-3">
        <button onClick={() => onStart(cards)} className="btn-gold">
          <Heart size={17} /> בוא/י ניתן הזדמנות שנייה
        </button>
        <button onClick={onSkip} className="btn-ghost">
          לא, תודה
        </button>
      </div>
    </motion.div>
  );
}

const INVITE_TEXT = "הצטרפו אליי ל־MELA, פלטפורמת ההיכרויות של הקהילה. אהבה עם שורשים 🤎";

function Invite({ premium, onNext }: { premium: boolean; onNext: () => void }) {
  const [ref, setRef] = useState<Referral | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api<Referral>("/api/referral").then(setRef, () => {});
  }, []);

  async function share() {
    if (!ref) return;
    if (await shareInvite(ref.link, INVITE_TEXT)) track("invite_share", { place: "journey" });
  }
  async function copy() {
    if (!ref) return;
    try {
      await navigator.clipboard.writeText(ref.link);
      setCopied(true);
      haptic(10);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <motion.div {...swap} className="flex flex-col items-center text-center">
      <Halo>
        <Gift size={30} strokeWidth={1.5} />
      </Halo>
      <h2 className="font-display text-[1.7rem] font-bold">{premium ? "הזמינו חברים ל־MELA" : "הזמינו חברים, קבלו לייקים"}</h2>
      {!premium && (
        <div className="mt-2 rounded-full border border-gold/30 bg-gold/[0.08] px-4 py-1 text-[13.5px] font-semibold text-gold-3">🎁 {ref?.bonus ?? 10} לייקים על כל חבר/ה שמצטרף/ת</div>
      )}
      <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-mute">
        {premium
          ? "ככל שיותר חברים מהקהילה מצטרפים, כך מחכות לך יותר התאמות. שתפו את הקישור האישי שלכם."
          : "שתפו את הקישור האישי שלכם. הלייקים נוספים ברגע שחבר/ה נרשם/ת, ולא פגים. וככל שהקהילה גדלה, מחכות לך יותר התאמות."}
      </p>
      {ref && ref.joined > 0 && (
        <div className="mt-4 rounded-full border border-gold/30 bg-gold/[0.08] px-4 py-1.5 text-[13px] text-gold-3">
          {ref.joined === 1 ? "חבר/ה אחד/ת הצטרף/ה" : `${ref.joined} חברים הצטרפו`} דרכך{!premium && ref.earned > 0 ? ` · קיבלת ${ref.earned} לייקים` : ""}
        </div>
      )}
      <div className="mt-7 flex w-full flex-col gap-3">
        <button onClick={share} disabled={!ref} className="btn-gold">
          <Share2 size={17} /> שיתוף הקישור שלי
        </button>
        <button onClick={copy} disabled={!ref} className="btn-ghost">
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "הקישור הועתק" : "העתקת הקישור"}
        </button>
        <button onClick={onNext} className="text-[13px] text-mute">
          המשך
        </button>
      </div>
    </motion.div>
  );
}

function nextMidnight(): string {
  const now = Date.now();
  const today = israelDay();
  for (let m = 1; m <= 26 * 60; m += 1) {
    const t = new Date(now + m * 60_000);
    if (new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(t) !== today) return t.toISOString();
  }
  return new Date(now + 86_400_000).toISOString();
}

function useCountdown(to: string) {
  const calc = useCallback(() => {
    const s = Math.max(0, Math.floor((new Date(to).getTime() - Date.now()) / 1000));
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  }, [to]);
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    const t = setInterval(() => setLeft(calc()), 1000);
    return () => clearInterval(t);
  }, [calc]);
  return left;
}

function Waiting({ fresh, resetsAt, onRefresh, onInvite }: { fresh: boolean; resetsAt: string | null; onRefresh: () => void; onInvite: () => void }) {
  const [to] = useState(() => resetsAt ?? nextMidnight());
  const left = useCountdown(to);
  const [alerts, setAlerts] = useState<{ on: boolean; canEmail: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ on: boolean; canEmail: boolean }>("/api/match-alerts").then(setAlerts, () => {});
  }, []);

  async function toggle() {
    if (!alerts || busy) return;
    setBusy(true);
    try {
      const r = await api<{ on: boolean }>("/api/match-alerts", { method: "POST", json: { on: !alerts.on } });
      setAlerts({ ...alerts, on: r.on });
      haptic(10);
      if (r.on) track("match_alerts_on");
    } catch {
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div {...swap} className="flex flex-col items-center text-center">
      <Halo>
        <Heart size={30} strokeWidth={1.5} />
      </Halo>
      <h2 className="font-display text-[1.7rem] font-bold">ההתאמה הבאה בדרך אלייך 💛</h2>
      <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-mute">
        {fresh ? "כל יום מצטרפים חברים חדשים לקהילה. נעדכן אותך ברגע שיגיע מישהו שמתאים לך." : "פרופילים חדשים מצטרפים כל יום. הבחירות היומיות הבאות שלך מחכות בעוד:"}
      </p>
      {!fresh && (
        <div className="tabular mt-4 font-display text-[2.2rem] font-bold tracking-wider text-gold-3" dir="ltr">
          {left}
        </div>
      )}
      {alerts?.canEmail && (
        <button onClick={toggle} disabled={busy} className="surface press mt-6 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-start" aria-pressed={alerts.on}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/[0.08] text-gold-2">
            <Bell size={17} />
          </span>
          <span className="flex-1 text-[13.5px] leading-snug">שלחו לי מייל כשמצטרף/ת מישהו/י שמתאים/ה לי</span>
          <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${alerts.on ? "bg-gold" : "bg-fg/15"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${alerts.on ? "left-[22px]" : "left-0.5"}`} />
          </span>
        </button>
      )}
      <div className="mt-6 flex w-full flex-col gap-3">
        {!fresh && (
          <Link href="/picks" className="btn-gold">
            <Sparkles size={17} /> לבחירות היום
          </Link>
        )}
        <button onClick={onRefresh} className="btn-ghost">
          <RotateCcw size={16} /> רענון
        </button>
        <button onClick={onInvite} className="text-[13px] text-mute">
          <Share2 size={13} className="inline" /> הזמנת חברים
        </button>
      </div>
    </motion.div>
  );
}
