"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Heart, Loader2, Sparkles, X } from "lucide-react";
import { Photo } from "./Photo";
import { ProfileCard } from "./ProfileCard";
import { CommentSheet } from "./CommentSheet";
import { MatchModal } from "./MatchModal";
import { api, haptic } from "@/lib/client";
import type { Candidate, Prompt, PublicProfile } from "@/lib/types";

function untilMidnight() {
  const now = new Date();
  const il = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  const mins = 24 * 60 - (il.getHours() * 60 + il.getMinutes());
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`;
}

export function PicksView() {
  const [picks, setPicks] = useState<Candidate[] | null>(null);
  const [done, setDone] = useState<Record<number, "like" | "pass">>({});
  const [open, setOpen] = useState<Candidate | null>(null);
  const [sheet, setSheet] = useState<Prompt | null>(null);
  const [match, setMatch] = useState<{ other: PublicProfile; matchId: number } | null>(null);
  const [clock, setClock] = useState("");

  useEffect(() => {
    api<{ picks: Candidate[] }>("/api/daily-picks").then((d) => setPicks(d.picks)).catch(() => setPicks([]));
    setClock(untilMidnight());
    const t = setInterval(() => setClock(untilMidnight()), 30_000);
    return () => clearInterval(t);
  }, []);

  async function decide(c: Candidate, action: "like" | "pass", comment?: { text: string; promptKey?: string }) {
    haptic();
    setDone((d) => ({ ...d, [c.id]: action }));
    setOpen(null);
    setSheet(null);
    const res = await api<{ isNewMatch: boolean; matchId: number; other?: PublicProfile }>("/api/swipe", {
      method: "POST",
      json: { targetId: c.id, action, comment },
    }).catch(() => null);
    if (res?.isNewMatch && res.other) setMatch({ other: res.other, matchId: res.matchId });
  }

  return (
    <section>
      <div className="flex items-end justify-between px-1">
        <div>
          <h1 className="font-display text-3xl font-bold">בחירות היום</h1>
          <p className="mt-1 text-sm text-mute">3 אנשים שנבחרו במיוחד בשבילך</p>
        </div>
        <div className="glass rounded-full px-3 py-1.5 text-xs text-gold-2" dir="ltr">
          ⏳ {clock}
        </div>
      </div>

      {picks === null ? (
        <div className="grid h-60 place-items-center">
          <Loader2 className="animate-spin text-gold" />
        </div>
      ) : picks.length === 0 ? (
        <div className="glass mt-5 rounded-3xl p-8 text-center text-sm text-mute">אין בחירות חדשות כרגע. נסו שוב מחר 💛</div>
      ) : (
        <div className="no-scrollbar -mx-4 mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
          {picks.map((c, i) => (
            <button
              key={c.id}
              onClick={() => !done[c.id] && setOpen(c)}
              className="animate-rise relative aspect-[3/4] w-[72%] shrink-0 snap-center overflow-hidden rounded-[28px] text-right"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <Photo src={c.photos[0]} name={c.full_name} className="h-full w-full" rounded="rounded-[28px]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
              <div className="glass absolute top-3 right-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-gold-2">
                <Sparkles size={11} /> {c.compatibility}%
              </div>
              <div className="absolute inset-x-0 bottom-0 p-4">
                <div className="text-xl font-bold">
                  {c.full_name.split(" ")[0]}, <span className="font-light">{c.age}</span>
                </div>
                <div className="text-xs text-cream/75">
                  {c.occupation} · {c.location}
                </div>
              </div>
              {done[c.id] && (
                <div className="absolute inset-0 grid place-items-center bg-ink/70 backdrop-blur-sm">
                  <span className={`animate-pop grid h-16 w-16 place-items-center rounded-full ${done[c.id] === "like" ? "bg-gold text-ink" : "glass"}`}>
                    {done[c.id] === "like" ? <Heart className="fill-current" /> : <X />}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-40 mx-auto max-w-md overflow-y-auto bg-ink px-3 pt-[max(env(safe-area-inset-top),12px)] pb-40">
          <button onClick={() => setOpen(null)} className="mb-3 flex h-12 items-center gap-1 px-2 text-sm text-mute">
            <ArrowRight size={18} /> חזרה
          </button>
          <ProfileCard c={open} onPromptLike={setSheet} />
          <div className="fixed inset-x-0 bottom-8 z-50 mx-auto flex max-w-md justify-center gap-6">
            <button onClick={() => decide(open, "pass")} className="glass grid h-16 w-16 place-items-center rounded-full shadow-xl" aria-label="דילוג">
              <X size={28} />
            </button>
            <button
              onClick={() => decide(open, "like")}
              className="grid h-[72px] w-[72px] place-items-center rounded-full bg-gradient-to-b from-gold-2 to-gold text-ink shadow-[0_12px_40px_-8px_rgba(212,175,55,0.7)]"
              aria-label="לייק"
            >
              <Heart size={30} className="fill-current" />
            </button>
          </div>
          {sheet && (
            <CommentSheet
              name={open.full_name}
              prompt={sheet}
              onClose={() => setSheet(null)}
              onSend={(text) => decide(open, "like", { text, promptKey: sheet.question_key })}
            />
          )}
        </div>
      )}
      {match && <MatchModal {...match} onClose={() => setMatch(null)} />}
    </section>
  );
}
