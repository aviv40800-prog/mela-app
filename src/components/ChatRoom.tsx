"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BadgeCheck, CalendarHeart, Check, CheckCheck, Coffee, MapPin, SendHorizontal, X } from "lucide-react";
import { DatePlanner, DatePlannerSheet } from "./DatePlanner";
import { Photo } from "./Photo";
import { useRealtime } from "./Realtime";
import { api, haptic } from "@/lib/client";
import { DATE_PREFIX, ICEBREAKERS } from "@/lib/content";
import type { DatePlan } from "@/lib/dates";
import type { ChatMessage, PublicProfile } from "@/lib/types";

const TZ = "Asia/Jerusalem";
const time = (iso: string) => new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });

function dayLabel(iso: string) {
  const k = dayKey(iso);
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  if (k === today) return "היום";
  if (k === yesterday) return "אתמול";
  return new Date(iso).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
}

const GROUP_GAP_MS = 5 * 60 * 1000;

export function ChatRoom({
  matchId,
  meId,
  partner,
  initial,
  plan,
  shared = [],
}: {
  matchId: number;
  meId: number;
  partner: PublicProfile;
  initial: ChatMessage[];
  plan: DatePlan;
  shared?: string[];
}) {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [tray, setTray] = useState(initial.length > 0 && initial.length < 3);
  const [planner, setPlanner] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastTypingSent = useRef(0);
  const first = partner.full_name.split(" ")[0];
  const [icebreakers] = useState(() => [...ICEBREAKERS].sort(() => Math.random() - 0.5).slice(0, 4));

  const markRead = () => void api(`/api/matches/${matchId}/read`, { method: "POST" }).catch(() => {});
  useEffect(markRead, [matchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const initialScroll = useRef(true);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: initialScroll.current ? "auto" : "smooth" });
    initialScroll.current = false;
  }, [messages.length, typing]);

  useRealtime((e) => {
    if (e.matchId !== matchId) return;
    if (e.type === "message") {
      setMessages((m) => (m.some((x) => x.id === e.message.id) ? m : [...m, e.message]));
      if (e.message.sender_id !== meId) {
        setTyping(false);
        haptic(8);
        markRead();
      }
    }
    if (e.type === "read" && e.readerId !== meId) setMessages((m) => m.map((x) => (x.sender_id === meId ? { ...x, is_read: true } : x)));
    if (e.type === "typing" && e.userId !== meId) {
      setTyping(true);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(false), 4000);
    }
  });

  // Catch up after the SSE connection dropped (e.g. phone was locked).
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      const lastId = messages.at(-1)?.id ?? 0;
      const { messages: newer } = await api<{ messages: ChatMessage[] }>(`/api/matches/${matchId}/messages?after=${lastId}`);
      if (newer.length) setMessages((m) => [...m, ...newer.filter((n) => !m.some((x) => x.id === n.id))]);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [matchId, messages]);

  // Auto-grow the composer up to ~5 lines.
  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  async function send(body: string) {
    const t = body.trim();
    if (!t || sending) return;
    setSending(true);
    setText("");
    setTray(false);
    haptic(10);
    try {
      const { message } = await api<{ message: ChatMessage }>(`/api/matches/${matchId}/messages`, { method: "POST", json: { text: t } });
      setMessages((m) => (m.some((x) => x.id === message.id) ? m : [...m, message]));
    } catch {
      setText(t);
    } finally {
      setSending(false);
      input.current?.focus();
    }
  }

  function onType(v: string) {
    setText(v);
    if (Date.now() - lastTypingSent.current > 2500) {
      lastTypingSent.current = Date.now();
      void api(`/api/matches/${matchId}/read?typing=1`, { method: "POST" }).catch(() => {});
    }
  }

  const lastMine = [...messages].reverse().find((m) => m.sender_id === meId);
  const proposed = messages.some((m) => m.text_content.startsWith(DATE_PREFIX));
  const nudge = messages.length >= 8 && !proposed;

  return (
    <main className="flex h-dvh flex-col">
      <header className="relative z-10 flex items-center gap-3 border-b border-line bg-ink/70 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3 backdrop-blur-2xl">
        <Link href="/matches" className="grid h-10 w-10 place-items-center rounded-full text-mute transition hover:bg-fg/5 hover:text-cream" aria-label="חזרה">
          <ArrowRight size={21} />
        </Link>
        <div className="h-11 w-11 overflow-hidden rounded-full ring-2 ring-gold/50 ring-offset-2 ring-offset-ink">
          <Photo src={partner.photos[0]} name={partner.full_name} className="h-full w-full" rounded="rounded-full" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-[16px] font-semibold">
            {first} {partner.is_verified && <BadgeCheck size={16} className="fill-gold/15 text-gold-2" />}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={typing ? "t" : "s"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="truncate text-xs text-mute">
              {typing ? <span className="text-gold-2">מקליד/ה…</span> : [partner.occupation, partner.location].filter(Boolean).join(" · ")}
            </motion.div>
          </AnimatePresence>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setPlanner(true)}
          className="flex h-10 items-center gap-1.5 rounded-full border border-gold/30 bg-gold/[0.07] px-3.5 text-[13px] font-medium text-gold-2 transition hover:border-gold/60 hover:bg-gold/[0.12]"
          aria-label="רעיונות לדייט"
        >
          <CalendarHeart size={16} strokeWidth={1.75} /> דייט
        </motion.button>
      </header>

      <div ref={scroller} className="no-scrollbar flex-1 overflow-y-auto px-4 pt-4 pb-3">
        {messages.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center pt-8 pb-7 text-center">
            <div className="relative">
              <div className="absolute inset-0 animate-pulse-ring rounded-full" />
              <div className="h-28 w-28 overflow-hidden rounded-full ring-2 ring-gold/60 ring-offset-4 ring-offset-ink">
                <Photo src={partner.photos[0]} name={partner.full_name} className="h-full w-full" rounded="rounded-full" />
              </div>
            </div>
            <p className="eyebrow mt-7">התאמה חדשה</p>
            <p className="font-display mt-1.5 text-[1.75rem] leading-tight">התאמתם עם {first}</p>
            {shared.length > 0 ? (
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {shared.map((t, i) => (
                  <motion.span
                    key={t}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.15 + i * 0.07 }}
                    className="rounded-full border border-gold/25 bg-gold/[0.06] px-3 py-1 text-[12.5px] text-cream/85"
                  >
                    {t}
                  </motion.span>
                ))}
              </div>
            ) : (
              <p className="mt-1.5 max-w-[16rem] text-sm text-mute">ההודעה הראשונה היא החלק הכי קשה. אפשר להתחיל מפתיח מהבית — או ישר מהצעה לדייט.</p>
            )}
          </motion.div>
        )}
        {/* Until someone proposes a date, the planner sits at the top of the conversation and scrolls away as it grows. */}
        {!proposed && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, type: "spring", stiffness: 260, damping: 30 }} className="pb-2">
            <DatePlanner matchId={matchId} partnerFirst={first} initial={plan} onPropose={send} compact />
          </motion.div>
        )}

        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const mine = m.sender_id === meId;
          const newDay = !prev || dayKey(prev.sent_at) !== dayKey(m.sent_at);
          const joinPrev = !newDay && prev?.sender_id === m.sender_id && +new Date(m.sent_at) - +new Date(prev.sent_at) < GROUP_GAP_MS;
          const joinNext = !!next && next.sender_id === m.sender_id && dayKey(next.sent_at) === dayKey(m.sent_at) && +new Date(next.sent_at) - +new Date(m.sent_at) < GROUP_GAP_MS;
          // Mine sit on the left (RTL), theirs on the right; the "tail" corner tightens inside a group.
          const corners = mine
            ? `rounded-[22px] ${joinPrev ? "rounded-tl-md" : ""} ${joinNext ? "rounded-bl-md" : "rounded-bl-sm"}`
            : `rounded-[22px] ${joinPrev ? "rounded-tr-md" : ""} ${joinNext ? "rounded-br-md" : "rounded-br-sm"}`;
          const quote = m.text_content.startsWith("💬 על ״") ? m.text_content.split("\n") : null;
          const proposal = m.text_content.startsWith(DATE_PREFIX) ? m.text_content.split("\n").slice(1) : null;

          return (
            <Fragment key={m.id}>
              {newDay && (
                <div className="my-4 flex items-center gap-3">
                  <div className="hairline flex-1" />
                  <span className="text-[11px] font-medium text-mute-2">{dayLabel(m.sent_at)}</span>
                  <div className="hairline flex-1" />
                </div>
              )}
              <motion.div
                layout="position"
                initial={{ opacity: 0, y: 12, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 34 }}
                style={{ transformOrigin: mine ? "left bottom" : "right bottom" }}
                className={`flex ${mine ? "justify-end" : "justify-start"} ${joinPrev ? "mt-[3px]" : "mt-3"}`}
              >
                <div className="max-w-[80%]">
                  <div
                    className={`px-4 py-2.5 text-[15.5px] leading-[1.45] whitespace-pre-line ${corners} ${
                      mine
                        ? "bg-gradient-to-b from-[#cd6d4e] to-[#b4573a] text-[#fffaf3] shadow-[0_8px_22px_-12px_rgba(180,87,58,0.8),inset_0_1px_0_rgba(70,42,24,0.35)]"
                        : "border border-fg/[0.06] bg-ink-4 text-cream shadow-[0_8px_22px_-14px_rgba(90,52,26,0.27)]"
                    }`}
                  >
                    {proposal ? (
                      <span className="block min-w-[13rem]">
                        <span className={`flex items-center gap-1.5 text-[11px] font-semibold tracking-wide ${mine ? "text-ink/65" : "text-gold-2"}`}>
                          <CalendarHeart size={13} /> הצעה לדייט
                        </span>
                        <span className="font-display mt-1 block text-[1.15rem] leading-snug">{proposal[0]}</span>
                        {proposal[1] && (
                          <span className={`mt-1.5 flex items-start gap-1 text-[12.5px] leading-snug ${mine ? "text-ink/70" : "text-mute"}`}>
                            <MapPin size={12} className="mt-[3px] shrink-0" /> {proposal[1]}
                          </span>
                        )}
                      </span>
                    ) : quote ? (
                      <>
                        <span className={`mb-1.5 block border-r-2 pr-2 text-[12px] leading-snug ${mine ? "border-ink/30 text-ink/70" : "border-gold/60 text-gold-2/90"}`}>
                          {quote[0].replace("💬 על ", "")}
                        </span>
                        {quote.slice(1).join("\n")}
                      </>
                    ) : (
                      m.text_content
                    )}
                  </div>
                  {!joinNext && (
                    <div className={`tabular mt-1 flex items-center gap-1 px-1.5 text-[10.5px] text-mute-2 ${mine ? "justify-end" : ""}`}>
                      {time(m.sent_at)}
                      {mine && m.id === lastMine?.id && (
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span key={m.is_read ? "r" : "s"} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                            {m.is_read ? <CheckCheck size={13} className="text-gold-2" /> : <Check size={13} />}
                          </motion.span>
                        </AnimatePresence>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            </Fragment>
          );
        })}

        <AnimatePresence>
          {typing && (
            <motion.div initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} style={{ transformOrigin: "right bottom" }} className="mt-3 flex justify-start">
              <div className="flex gap-1.5 rounded-[22px] rounded-br-sm border border-fg/[0.06] bg-ink-4 px-4 py-3.5">
                {[0, 1, 2].map((d) => (
                  <motion.span key={d} className="h-2 w-2 rounded-full bg-gold-2/80" animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {planner && <DatePlannerSheet matchId={matchId} partnerFirst={first} initial={plan} onPropose={async (t) => { setPlanner(false); await send(t); }} onClose={() => setPlanner(false)} />}
      </AnimatePresence>

      {/* after a real conversation, nudge toward actually meeting */}
      <AnimatePresence>
        {nudge && !tray && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            onClick={() => setPlanner(true)}
            className="mx-4 mb-2 flex items-center gap-3 rounded-2xl border border-gold/25 bg-ink-3/80 px-4 py-2.5 text-right backdrop-blur-xl"
          >
            <CalendarHeart size={17} className="shrink-0 text-gold-2" strokeWidth={1.75} />
            <span className="flex-1 text-[13px] text-cream/85">נראה שיש כימיה. מוכנים להיפגש? יש לנו 3 רעיונות בשבילכם</span>
            <span className="text-[12px] font-semibold text-gold-2">לרעיונות</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* icebreaker tray */}
      <AnimatePresence initial={false}>
        {tray && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 38 }} className="overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-1 pb-2">
              <span className="eyebrow flex items-center gap-1.5">
                <Coffee size={12} /> פתיחים מהבית
              </span>
              <button onClick={() => setTray(false)} className="text-mute-2 transition hover:text-cream" aria-label="סגירת פתיחים">
                <X size={15} />
              </button>
            </div>
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
              {icebreakers.map((ib, i) => (
                <motion.button
                  key={ib}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => send(ib)}
                  className="max-w-[16rem] shrink-0 rounded-2xl border border-gold/20 bg-gradient-to-b from-gold/[0.08] to-transparent px-3.5 py-2.5 text-right text-[13px] leading-snug text-cream/90 transition hover:border-gold/45"
                >
                  {ib}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
        className="flex items-end gap-2 border-t border-line bg-ink/80 px-3 pt-3 backdrop-blur-2xl safe-bottom"
      >
        <motion.button
          type="button"
          whileTap={{ scale: 0.85 }}
          onClick={() => setTray((t) => !t)}
          className={`mb-[3px] grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors ${tray ? "bg-gold/15 text-gold-2" : "text-mute hover:text-gold-2"}`}
          aria-label="פתיחים"
          aria-pressed={tray}
        >
          <Coffee size={20} strokeWidth={1.75} />
        </motion.button>
        <div className="field flex-1 !rounded-[24px] !p-0">
          <textarea
            ref={input}
            rows={1}
            value={text}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send(text);
              }
            }}
            placeholder={`הודעה ל${first}…`}
            className="block max-h-[140px] w-full resize-none bg-transparent px-4 py-[13px] text-[16px] leading-[1.35] outline-none placeholder:text-mute-2"
          />
        </div>
        <AnimatePresence initial={false}>
          {text.trim() && (
            <motion.button
              key="send"
              initial={{ scale: 0, rotate: 90, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileTap={{ scale: 0.85 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              disabled={sending}
              className="mb-[3px] grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-b from-gold-3 to-gold text-ink shadow-[0_8px_22px_-8px_rgba(180,87,58,0.9)]"
              aria-label="שליחה"
            >
              <SendHorizontal size={19} className="rotate-180" />
            </motion.button>
          )}
        </AnimatePresence>
      </form>
    </main>
  );
}
