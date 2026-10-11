"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CheckCheck, Check, SendHorizontal, Sparkles } from "lucide-react";
import { Photo } from "./Photo";
import { useRealtime } from "./Realtime";
import { api } from "@/lib/client";
import { ICEBREAKERS } from "@/lib/content";
import type { ChatMessage, PublicProfile } from "@/lib/types";

const fmt = (iso: string) =>
  new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });

export function ChatRoom({ matchId, meId, partner, initial }: { matchId: number; meId: number; partner: PublicProfile; initial: ChatMessage[] }) {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastTypingSent = useRef(0);
  const first = partner.full_name.split(" ")[0];
  const icebreakers = useRef([...ICEBREAKERS].sort(() => Math.random() - 0.5).slice(0, 3)).current;

  const markRead = () => void api(`/api/matches/${matchId}/read`, { method: "POST" }).catch(() => {});

  useEffect(markRead, [matchId]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length, typing]);

  useRealtime((e) => {
    if (e.matchId !== matchId) return;
    if (e.type === "message") {
      setMessages((m) => (m.some((x) => x.id === e.message.id) ? m : [...m, e.message]));
      if (e.message.sender_id !== meId) {
        setTyping(false);
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

  // Fallback catch-up in case the SSE connection dropped (e.g. phone was locked).
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

  async function send(body: string) {
    const t = body.trim();
    if (!t || sending) return;
    setSending(true);
    setText("");
    try {
      const { message } = await api<{ message: ChatMessage }>(`/api/matches/${matchId}/messages`, { method: "POST", json: { text: t } });
      setMessages((m) => (m.some((x) => x.id === message.id) ? m : [...m, message]));
    } catch {
      setText(t);
    } finally {
      setSending(false);
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

  return (
    <main className="flex h-dvh flex-col">
      <header className="glass z-10 flex items-center gap-3 rounded-none border-x-0 border-t-0 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <Link href="/matches" className="text-mute" aria-label="חזרה">
          <ArrowRight />
        </Link>
        <div className="h-10 w-10 overflow-hidden rounded-full">
          <Photo src={partner.photos[0]} name={partner.full_name} className="h-full w-full" rounded="rounded-full" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1 font-semibold">
            {first} {partner.is_verified && <BadgeCheck size={16} className="text-gold" />}
          </div>
          <div className="text-xs text-mute">{typing ? <span className="text-gold-2">מקליד/ה...</span> : `${partner.occupation ?? ""} · ${partner.location ?? ""}`}</div>
        </div>
      </header>

      <div className="no-scrollbar flex-1 space-y-2 overflow-y-auto px-4 py-5">
        {messages.length === 0 && (
          <div className="animate-rise py-10 text-center">
            <div className="glow mx-auto h-24 w-24 overflow-hidden rounded-full">
              <Photo src={partner.photos[0]} name={partner.full_name} className="h-full w-full" rounded="rounded-full" />
            </div>
            <p className="font-display mt-4 text-xl">התאמתם עם {first} ✨</p>
            <p className="mt-1 text-sm text-mute">שבירת קרח? בחר/י פתיח למטה.</p>
          </div>
        )}
        {messages.map((m, i) => {
          const mine = m.sender_id === meId;
          const showTime = i === messages.length - 1 || messages[i + 1].sender_id !== m.sender_id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[78%]">
                <div
                  className={`animate-rise rounded-3xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-line ${
                    mine ? "rounded-bl-lg bg-gradient-to-b from-gold-2 to-gold text-ink" : "glass rounded-br-lg"
                  }`}
                >
                  {m.text_content}
                </div>
                {showTime && (
                  <div className={`mt-1 flex items-center gap-1 px-2 text-[10px] text-mute ${mine ? "justify-end" : ""}`}>
                    {fmt(m.sent_at)}
                    {mine && m.id === lastMine?.id && (m.is_read ? <CheckCheck size={12} className="text-gold" /> : <Check size={12} />)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {typing && (
          <div className="flex justify-start">
            <div className="glass flex gap-1 rounded-3xl rounded-br-lg px-4 py-3">
              {[0, 1, 2].map((d) => (
                <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-gold/70" style={{ animationDelay: `${d * 120}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      {messages.length < 4 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2">
          <span className="flex shrink-0 items-center gap-1 text-xs text-gold">
            <Sparkles size={12} /> פתיחים:
          </span>
          {icebreakers.map((ib) => (
            <button key={ib} onClick={() => send(ib)} className="glass shrink-0 rounded-full px-3.5 py-2 text-xs whitespace-nowrap hover:border-gold/40">
              {ib}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
        className="flex items-end gap-2 border-t border-line px-3 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]"
      >
        <textarea
          rows={1}
          value={text}
          onChange={(e) => onType(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(text);
            }
          }}
          placeholder={`הודעה ל${first}...`}
          className="field max-h-32 min-h-12 flex-1 resize-none rounded-3xl py-3"
        />
        <button
          disabled={!text.trim() || sending}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-b from-gold-2 to-gold text-ink transition active:scale-90 disabled:opacity-40"
          aria-label="שליחה"
        >
          <SendHorizontal size={20} className="rotate-180" />
        </button>
      </form>
    </main>
  );
}
