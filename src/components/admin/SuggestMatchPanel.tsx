"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Heart, Loader2, Mail, Sparkles, X } from "lucide-react";
import { api } from "@/lib/client";
import { Photo } from "../Photo";

type Candidate = { id: number; name: string; age: number | null; location: string | null; photo: string | null; compatibility: number; likedThem: boolean };
type Suggestion = {
  id: number;
  createdAt: string;
  other: { id: number; name: string; photo: string | null };
  noteMine: string;
  noteTheirs: string;
  seenMine: boolean;
  seenTheirs: boolean;
  mine: "liked" | "passed" | null;
  theirs: "liked" | "passed" | null;
  matched: boolean;
  matchId: number | null;
  chat: { by: "none" | "both" } | { by: "one"; senderId: number; label: string };
  nudgedMine: string | null;
  nudgedTheirs: string | null;
  sent: string[];
};
type Data = { reason: string | null; candidates: Candidate[]; suggestions: Suggestion[] };

const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? n;

function Step({ done, label }: { done: boolean; label: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] ${done ? "bg-gold/15 text-gold-3" : "bg-fg/[0.05] text-mute"}`}>{done ? "✓ " : ""}{label}</span>;
}

function Decision({ who, d }: { who: string; d: "liked" | "passed" | null }) {
  if (d === "liked") return <Step done label={`${who} עשה/תה לייק`} />;
  if (d === "passed") return <span className="rounded-full bg-fg/[0.05] px-2 py-0.5 text-[11px] text-mute">✕ {who} דילג/ה</span>;
  return <Step done={false} label={`${who} עוד לא החליט/ה`} />;
}

const when = (sqlDate: string) => new Date(sqlDate.replace(" ", "T") + "Z").toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

/** After a match: email one side "they liked you back, time to write" (once is usually enough; can resend). */
function NudgeButton({ suggestionId, toId, toName, otherName, nudgedAt, onSent }: { suggestionId: number; toId: number; toName: string; otherName: string; nudgedAt: string | null; onSent: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function send() {
    if (nudgedAt && !confirm(`כבר נשלח ל${toName} מייל כזה. לשלוח שוב?`)) return;
    setBusy(true);
    setErr(null);
    try {
      await api("/api/admin/suggestions/nudge", { method: "POST", json: { id: suggestionId, to: toId } });
      onSent();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        onClick={send}
        disabled={busy}
        className="press flex w-full items-center justify-center gap-1.5 rounded-full border border-gold/40 bg-gold/[0.08] px-3 py-2 text-[12.5px] font-semibold text-gold-3 disabled:opacity-60"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
        {nudgedAt ? `נשלח ל${toName} ✓ (${when(nudgedAt)}) · לשלוח שוב` : `מייל ל${toName}: ${otherName} בהתאמה איתך, הגיע הזמן להתכתב`}
      </button>
      {err && <p className="mt-1 text-[12px] text-danger">{err}</p>}
    </div>
  );
}

/** Admin: suggest this member and another to each other ("personal matchmaking"), with a note for each side. */
export function SuggestMatchPanel({ userId, name }: { userId: number; name: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [pick, setPick] = useState<Candidate | null>(null);
  const [noteMine, setNoteMine] = useState("");
  const [noteTheirs, setNoteTheirs] = useState("");
  const [busy, setBusy] = useState<"draft" | "send" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(() => api<Data>(`/api/admin/suggestions?userId=${userId}`).then(setData, (e) => setErr((e as Error).message)), [userId]);
  useEffect(() => {
    void load();
  }, [load]);

  function choose(c: Candidate) {
    setPick(c);
    setNoteMine("");
    setNoteTheirs("");
    setErr(null);
    setSent(null);
  }

  async function draft() {
    if (!pick) return;
    setBusy("draft");
    setErr(null);
    try {
      const r = await api<{ noteA: string; noteB: string }>("/api/admin/suggestions/draft", { method: "POST", json: { a: userId, b: pick.id } });
      setNoteMine(r.noteA);
      setNoteTheirs(r.noteB);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (!pick) return;
    setBusy("send");
    setErr(null);
    try {
      const r = await api<{ emailed: { a: boolean; b: boolean } }>("/api/admin/suggestions", {
        method: "POST",
        json: { a: userId, b: pick.id, noteA: noteMine, noteB: noteTheirs },
      });
      const missing = [!r.emailed.a && firstName(name), !r.emailed.b && firstName(pick.name)].filter(Boolean);
      setSent(
        `ההצעה נשלחה 💛 ${firstName(name)} ו${firstName(pick.name)} יראו אחד את השני ראשונים במסך הגילוי.` +
          (missing.length ? ` (ל${missing.join(" ול")} אין מייל מאומת, אז רק באתר.)` : " שניהם קיבלו מייל."),
      );
      setPick(null);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!data) return <div className="skeleton h-32 rounded-2xl" />;
  const list = showAll ? data.candidates : data.candidates.slice(0, 8);

  return (
    <div className="space-y-5">
      {sent && <p className="rounded-2xl border border-gold/30 bg-gold/[0.07] px-4 py-3 text-sm text-gold-3">{sent}</p>}

      {data.reason ? (
        <p className="text-sm text-mute">אי אפשר להציע שידוך כרגע: {data.reason}.</p>
      ) : pick ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Photo src={pick.photo} name={pick.name} rounded="rounded-full" className="h-11 w-11" />
            <div className="flex-1">
              <div className="font-semibold">
                {firstName(name)} 💛 {pick.name}
              </div>
              <div className="text-[12px] text-mute">
                {[pick.age, pick.location].filter(Boolean).join(" · ")} · {pick.compatibility}% התאמה
              </div>
            </div>
            <button onClick={() => setPick(null)} className="text-mute hover:text-cream" aria-label="ביטול">
              <X size={18} />
            </button>
          </div>

          <button onClick={draft} disabled={!!busy} className="btn-ghost w-full py-2.5 text-sm">
            {busy === "draft" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} תכתוב לי נימוק
          </button>

          <label className="block">
            <span className="text-[12.5px] text-mute">מה {firstName(name)} יקבל/תקבל: למה {firstName(pick.name)} מתאים/ה</span>
            <textarea value={noteMine} onChange={(e) => setNoteMine(e.target.value)} rows={3} maxLength={600} className="field mt-1 w-full resize-y text-[14px]" placeholder="למשל: שניכם כתבתם שהמשפחה במרכז…" />
          </label>
          <label className="block">
            <span className="text-[12.5px] text-mute">מה {firstName(pick.name)} יקבל/תקבל: למה {firstName(name)} מתאים/ה</span>
            <textarea value={noteTheirs} onChange={(e) => setNoteTheirs(e.target.value)} rows={3} maxLength={600} className="field mt-1 w-full resize-y text-[14px]" />
          </label>

          <button onClick={send} disabled={!!busy || noteMine.trim().length < 10 || noteTheirs.trim().length < 10} className="btn-gold w-full py-3 text-sm">
            {busy === "send" ? <Loader2 size={16} className="animate-spin" /> : <Heart size={16} />} שליחת ההצעה לשניהם
          </button>
          <p className="text-[11.5px] leading-relaxed text-mute-2">
            שניהם יקבלו מייל עם הנימוק, ויראו אחד את השני ראשונים במסך הגילוי. הלייק על הצעה כזו לא נספר במכסה היומית. התאמה נפתחת רק אם שניהם עושים לייק.
          </p>
        </div>
      ) : data.candidates.length === 0 ? (
        <p className="text-sm text-mute">אין כרגע מועמדים מתאימים (מגדר, פרופיל מלא, בלי חסימות או הצעות קודמות).</p>
      ) : (
        <div>
          <p className="mb-3 text-[12.5px] text-mute">בחר/י למי להציע את {firstName(name)} (לפי אחוז התאמה):</p>
          <ul className="space-y-2">
            {list.map((c) => (
              <li key={c.id}>
                <button onClick={() => choose(c)} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-fg/[0.02] px-3 py-2.5 text-start transition hover:border-gold/40">
                  <Photo src={c.photo} name={c.name} rounded="rounded-full" className="h-10 w-10" />
                  <span className="flex-1">
                    <span className="block text-[14px] font-medium">{c.name}</span>
                    <span className="block text-[12px] text-mute">{[c.age, c.location].filter(Boolean).join(" · ")}</span>
                  </span>
                  {c.likedThem && <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[11px] text-gold-3">כבר עשה/תה לייק</span>}
                  <span className="tabular text-[13px] font-semibold text-gold-2">{c.compatibility}%</span>
                </button>
              </li>
            ))}
          </ul>
          {data.candidates.length > list.length && (
            <button onClick={() => setShowAll(true)} className="mt-2 text-[12.5px] text-mute hover:text-cream">
              הצגת כל {data.candidates.length} המועמדים
            </button>
          )}
        </div>
      )}

      {err && <p className="text-sm text-danger">{err}</p>}

      {data.suggestions.length > 0 && (
        <div>
          <div className="hairline mb-4" />
          <p className="mb-3 text-[12.5px] font-semibold">הצעות שנשלחו</p>
          <ul className="space-y-3">
            {data.suggestions.map((s) => (
              <li key={s.id} className="rounded-2xl border border-line bg-fg/[0.02] p-3">
                <div className="flex items-center gap-2.5">
                  <Photo src={s.other.photo} name={s.other.name} rounded="rounded-full" className="h-9 w-9" />
                  <Link href={`/admin/users/${s.other.id}`} className="flex-1 text-[14px] font-medium hover:text-gold-2">
                    {s.other.name}
                  </Link>
                  {s.matched && (
                    <span className="flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold text-[#2a1c12]">
                      <Check size={12} /> התאמה!
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Step done={s.seenMine} label={`${firstName(name)} ראה/תה`} />
                  <Step done={s.seenTheirs} label={`${firstName(s.other.name)} ראה/תה`} />
                  <Decision who={firstName(name)} d={s.mine} />
                  <Decision who={firstName(s.other.name)} d={s.theirs} />
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-mute">״{s.noteMine}״</p>
                {s.matched && (
                  <div className="mt-3 space-y-2 border-t border-line pt-3">
                    <p className="text-[12px] text-mute">{s.chat.by === "both"
                        ? "💬 התחילו להתכתב"
                        : s.chat.by === "one"
                          ? `💬 ${s.chat.label}, מחכים לתשובה`
                          : "💬 עוד אף אחד לא שלח הודעה"}</p>
                    {s.chat.by !== "none" && (
                      <div className="flex flex-wrap gap-1.5">
                        {s.sent.map((line) => (
                          <span key={line} className="rounded-full bg-fg/[0.05] px-2 py-0.5 text-[11px] text-cream/90">✉️ {line}</span>
                        ))}
                      </div>
                    )}
                    <NudgeButton suggestionId={s.id} toId={s.other.id} toName={firstName(s.other.name)} otherName={firstName(name)} nudgedAt={s.nudgedTheirs} onSent={load} />
                    <NudgeButton suggestionId={s.id} toId={userId} toName={firstName(name)} otherName={firstName(s.other.name)} nudgedAt={s.nudgedMine} onSent={load} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
