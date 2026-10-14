"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { ArrowLeft, Camera, Loader2, PenLine, RefreshCw } from "lucide-react";
import { api, haptic } from "@/lib/client";
import { compressImage, uploadPhoto } from "@/lib/upload";
import { CULTURAL_PROMPTS, LOOKING_FOR, MARITAL_STATUS, RELIGIOSITY } from "@/lib/content";
import type { ChatView, Draft } from "@/lib/ai-onboarding";

const TOTAL = 12;
const HEART = "M120 212 C48 160 4 116 4 66 C4 30 32 4 66 4 C92 4 110 18 120 38 C130 18 148 4 174 4 C208 4 236 30 236 66 C236 116 192 160 120 212 Z";
const bubbleIn = { initial: { opacity: 0, y: 10, scale: 0.94 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { type: "spring" as const, stiffness: 420, damping: 32 } };

/** What the host has learned so far — shown as chips that fly in as the conversation fills the profile. */
function facts(d: Draft): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  if (d.full_name) out.push({ key: "name", label: d.age ? `${d.full_name} · ${d.age}` : d.full_name });
  else if (d.age) out.push({ key: "name", label: String(d.age) });
  if (d.location) out.push({ key: "loc", label: d.location });
  if (d.occupation) out.push({ key: "job", label: d.occupation });
  if (d.looking_for) out.push({ key: "lf", label: LOOKING_FOR[d.looking_for] });
  if (d.marital_status) out.push({ key: "ms", label: MARITAL_STATUS[d.marital_status] });
  if (d.religiosity) out.push({ key: "rel", label: RELIGIOSITY[d.religiosity] });
  for (const p of d.prompts ?? []) out.push({ key: `p-${p.question_key}`, label: p.answer_text.length > 28 ? p.answer_text.slice(0, 26) + "…" : p.answer_text });
  return out;
}

export function OnboardingChat({ initial }: { initial: ChatView }) {
  const router = useRouter();
  const [chat, setChat] = useState(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const done = TOTAL - chat.missing.length;

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.messages.length, busy, chat.ask]);

  async function send(body: object, optimistic?: string) {
    setBusy(true);
    setErr(null);
    if (optimistic) setChat((c) => ({ ...c, messages: [...c.messages, { role: "user", text: optimistic }], choices: [] }));
    try {
      const next = await api<ChatView>("/api/onboarding/chat", { method: "POST", json: body });
      setChat(next);
      haptic(6);
    } catch (e) {
      setErr((e as Error).message);
      // keep the user's message visible; the server stored it too
    } finally {
      setBusy(false);
    }
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setText("");
    void send({ text: t }, t);
  }

  if (chat.done && revealed) return <Reveal draft={chat.draft} onFix={() => router.push("/onboarding/profile")} onDone={(next) => router.replace(next)} />;

  return (
    <div className="-mx-6 flex flex-1 flex-col pb-40">
      {/* host bar */}
      <div className="flex items-center justify-between px-5">
        <div className="flex items-center gap-2.5">
          <motion.svg width="30" height="28" viewBox="0 0 240 216" aria-hidden="true" animate={busy ? { scale: [1, 1.08, 1] } : { scale: 1 }} transition={{ duration: 1, repeat: busy ? Infinity : 0 }}>
            <path d={HEART} fill="rgb(229 56 59 / 0.25)" stroke="#ff5a63" strokeWidth="14" />
          </motion.svg>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold">המארחת של MELA</div>
            <div className="text-[12px] text-mute">{busy ? "מקלידה…" : "מכירה אותך · בדרך כלל עונה מיד"}</div>
          </div>
        </div>
        <Link href="/onboarding/profile" className="rounded-full border border-gold/30 px-3.5 py-2 text-[13px] text-cream/90 transition hover:border-gold/60">
          להשלים בטופס
        </Link>
      </div>

      {/* live profile */}
      <section aria-label="מה שלמדתי עלייך" className="mx-4 mt-4 rounded-[20px] border border-gold/35 bg-gradient-to-b from-gold/[0.12] to-gold/[0.04] p-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-gold-3">{done ? "מה שלמדתי עלייך עד עכשיו" : "הפרופיל שלך ייבנה כאן תוך כדי שיחה"}</span>
          <span className="tabular text-[12px] text-mute">
            {done} / {TOTAL}
          </span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-fg/10">
          <motion.div className="h-full rounded-full bg-gradient-to-l from-gold-3 to-rose" animate={{ width: `${(done / TOTAL) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
        </div>
        <LayoutGroup>
          <motion.div layout className="mt-2.5 flex flex-wrap gap-1.5">
            <AnimatePresence initial={false}>
              {facts(chat.draft).map((f) => (
                <motion.span
                  key={f.key + f.label}
                  layout
                  initial={{ opacity: 0, y: 26, scale: 0.7 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: "spring", stiffness: 380, damping: 26 }}
                  className="rounded-full border border-gold/25 bg-fg/[0.06] px-2.5 py-1 text-[12.5px]"
                >
                  {f.label}
                </motion.span>
              ))}
            </AnimatePresence>
          </motion.div>
        </LayoutGroup>
      </section>

      <p className="mx-5 mt-2 text-[11.5px] leading-relaxed text-mute-2">השיחה מעובדת בעזרת בינה מלאכותית (Claude של Anthropic) רק כדי לבנות את הפרופיל שלך. כל פרט אפשר לערוך לפני השמירה.</p>

      {/* conversation */}
      <div className="mt-4 flex flex-col gap-2.5 px-4" aria-live="polite">
        {chat.messages.map((m, i) => (
          <motion.div
            key={i}
            {...bubbleIn}
            className={`max-w-[84%] px-4 py-2.5 text-[15.5px] leading-relaxed ${
              m.role === "assistant"
                ? "self-start rounded-[20px] rounded-es-[6px] border border-gold/20 bg-fg/[0.06]"
                : "self-end rounded-[20px] rounded-ee-[6px] bg-gradient-to-b from-[#ff6670] to-[#c4152a] text-[#fff7f2]"
            }`}
          >
            {m.text}
          </motion.div>
        ))}
        <AnimatePresence>
          {busy && (
            <motion.div key="typing" {...bubbleIn} exit={{ opacity: 0 }} className="flex gap-1.5 self-start rounded-[18px] bg-fg/[0.05] px-4 py-3.5" aria-label="מקלידה">
              {[0, 1, 2].map((d) => (
                <motion.span key={d} className="h-1.5 w-1.5 rounded-full bg-gold" animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }} transition={{ duration: 1.1, repeat: Infinity, delay: d * 0.15 }} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* inline widgets */}
        {!busy && chat.ask === "bio" && chat.draft.bio_draft && <BioCard draft={chat.draft.bio_draft} onAnswer={(b) => send(b)} />}
        {!busy && chat.ask === "photos" && <PhotoPicker onDone={(photos) => send({ photos })} />}
        {chat.done && (
          <motion.button {...bubbleIn} onClick={() => setRevealed(true)} className="btn-gold mt-3 w-full">
            לראות את הפרופיל שלי
          </motion.button>
        )}
        {err && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-danger/30 bg-danger/[0.08] px-3.5 py-2.5 text-[13.5px] text-danger">
            {err}
            <Link href="/onboarding/profile" className="shrink-0 underline underline-offset-4">
              לטופס
            </Link>
          </div>
        )}
        <div ref={end} />
      </div>

      {/* composer */}
      {!chat.done && chat.ask !== "photos" && !(chat.ask === "bio" && chat.draft.bio_draft) && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md bg-gradient-to-t from-ink via-ink/95 to-transparent px-4 pt-8 safe-bottom">
          <AnimatePresence>
            {!busy && chat.choices.length > 0 && (
              <motion.div role="group" aria-label="בחירה מהירה" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="mb-2.5 grid grid-cols-2 gap-2">
                {chat.choices.map((c, i) => (
                  <motion.button
                    key={c.value}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: i * 0.06 } }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => send({ choice: { field: chat.ask, value: c.value, label: c.label } }, c.label)}
                    className="min-h-12 rounded-2xl border border-gold/35 bg-gold/[0.08] px-3 text-[14px] text-gold-3 transition hover:border-gold/70"
                  >
                    {c.label}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <form onSubmit={submit} className="flex items-center gap-2 rounded-[26px] border border-gold/25 bg-fg/[0.06] p-1.5 ps-4">
            <label htmlFor="chat-input" className="sr-only">
              הודעה
            </label>
            <input
              id="chat-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              autoComplete="off"
              placeholder={chat.messages.length <= 2 ? "למשל: אני דנה, 27, אחות ממודיעין…" : "כתבו בחופשיות…"}
              className="min-w-0 flex-1 bg-transparent py-2.5 text-[15.5px] outline-none placeholder:text-mute-2"
            />
            <button disabled={busy || !text.trim()} aria-label="שליחה" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#ff6670] to-[#c4152a] text-white transition disabled:opacity-40">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowLeft size={19} />}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function BioCard({ draft, onAnswer }: { draft: string; onAnswer: (b: { bio: "accept" | "other"; text?: string }) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(draft);
  return (
    <motion.article {...bubbleIn} className="flex flex-col gap-2.5 rounded-[20px] border border-dashed border-gold/45 bg-fg/[0.04] p-3.5">
      <span className="text-[12px] text-gold-3">הצעה לביו</span>
      {editing ? (
        <textarea value={val} onChange={(e) => setVal(e.target.value)} rows={4} maxLength={500} className="field resize-none text-[15px] leading-relaxed" aria-label="עריכת הביו" autoFocus />
      ) : (
        <p className="font-display text-[17px] leading-relaxed">{draft}</p>
      )}
      <button onClick={() => onAnswer(editing ? { bio: "accept", text: val } : { bio: "accept" })} className="btn-gold w-full !py-3 text-[15px]">
        {editing ? "שמירה" : "מושלם, לשמור"}
      </button>
      <div className="flex gap-2">
        {!editing && (
          <button onClick={() => setEditing(true)} className="btn-ghost flex-1 !py-2.5 text-[14px]">
            <PenLine size={15} /> לערוך
          </button>
        )}
        <button onClick={() => onAnswer({ bio: "other" })} className="btn-ghost flex-1 !py-2.5 text-[14px]">
          <RefreshCw size={15} /> נוסח אחר
        </button>
      </div>
    </motion.article>
  );
}

function PhotoPicker({ onDone }: { onDone: (urls: string[]) => void }) {
  const [urls, setUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setErr(null);
    const list = [...files].slice(0, 6 - urls.length);
    setUploading(list.length);
    for (const f of list) {
      try {
        const url = await uploadPhoto(await compressImage(f), () => {});
        setUrls((u) => [...u, url]);
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  return (
    <motion.div {...bubbleIn} className="flex flex-col gap-2.5">
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => {
          const u = urls[i];
          return (
            <button
              key={i}
              onClick={() => input.current?.click()}
              aria-label={i === 0 ? "הוספת תמונה ראשית" : "הוספת תמונה"}
              className={`relative aspect-[3/4] overflow-hidden rounded-2xl border border-dashed ${i === 0 ? "border-gold bg-gold/[0.08] text-gold-3" : "border-gold/30 bg-fg/[0.03] text-mute"} grid place-items-center`}
            >
              {u ? (
                // eslint-disable-next-line @next/next/no-img-element
                <motion.img src={u} alt="" className="absolute inset-0 h-full w-full object-cover" initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} />
              ) : uploading > 0 && i === urls.length ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <span className="flex flex-col items-center gap-1 text-[12px]">
                  <Camera size={i === 0 ? 24 : 20} strokeWidth={1.6} />
                  {i === 0 && "ראשית"}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => pick(e.target.files)} />
      {err && <p className="text-sm text-danger">{err}</p>}
      <button onClick={() => (urls.length ? onDone(urls) : input.current?.click())} disabled={uploading > 0} className="btn-gold w-full">
        {urls.length ? `המשך עם ${urls.length === 1 ? "התמונה" : `${urls.length} התמונות`}` : "בחירת תמונות"}
      </button>
    </motion.div>
  );
}

/** The finished profile, revealed as the card others will see. */
function Reveal({ draft, onFix, onDone }: { draft: Draft; onFix: () => void; onDone: (next: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function finish() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ next: string }>("/api/onboarding/chat/finish", { method: "POST" });
      haptic([10, 40, 20]);
      onDone(r.next);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }
  const prompt = draft.prompts?.[0];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-1 flex-col items-center gap-4 pb-6">
      <div className="text-center">
        <span className="text-[13px] text-gold-3">הכול מוכן</span>
        <h1 className="font-display text-[1.9rem] font-bold">ככה יראו אותך</h1>
      </div>
      <motion.article
        initial={{ rotateY: -70, opacity: 0, scale: 0.9 }}
        animate={{ rotateY: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 140, damping: 18 }}
        style={{ transformPerspective: 900 }}
        className="relative w-full overflow-hidden rounded-[28px] border border-gold/45 bg-ink-3 shadow-[0_30px_60px_rgb(0_0_0/0.45),0_0_50px_rgb(245_196_106/0.12)]"
      >
        {draft.photos?.[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={draft.photos[0]} alt="" className="h-[300px] w-full object-cover" />
        )}
        <div className="absolute inset-x-0 top-[230px] h-[70px] bg-gradient-to-t from-ink-3 to-transparent" />
        <div className="relative -mt-10 flex flex-col gap-2.5 px-4 pb-4">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[1.75rem] font-bold">{draft.full_name}</span>
            <span className="text-[1.3rem] text-cream/80">{draft.age}</span>
          </div>
          <span className="text-sm text-mute">{[draft.occupation, draft.location].filter(Boolean).join(" · ")}</span>
          <p className="text-[14.5px] leading-relaxed text-cream/85">{draft.bio}</p>
          {prompt && (
            <div className="rounded-2xl bg-fg/[0.05] px-3 py-2.5 text-[13.5px]">
              <span className="text-mute">{CULTURAL_PROMPTS.find((p) => p.key === prompt.question_key)?.question}</span>
              <div className="mt-0.5 font-medium">{prompt.answer_text}</div>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {[draft.looking_for && LOOKING_FOR[draft.looking_for], draft.religiosity && RELIGIOSITY[draft.religiosity], draft.marital_status && MARITAL_STATUS[draft.marital_status]]
              .filter(Boolean)
              .map((l) => (
                <span key={l as string} className="rounded-full border border-gold/30 px-2.5 py-1 text-[12.5px] text-gold-3">
                  {l}
                </span>
              ))}
          </div>
        </div>
      </motion.article>
      <p className="text-center text-[13px] text-mute">אפשר לערוך כל פרט עכשיו או מאוחר יותר מהפרופיל.</p>
      {err && <p className="text-sm text-danger">{err}</p>}
      <div className="mt-auto flex w-full flex-col gap-2">
        <button onClick={finish} disabled={busy} className="btn-gold animate-pulse-ring w-full text-[17px]">
          {busy ? <Loader2 className="animate-spin" size={18} /> : "יוצאים לגלות"}
        </button>
        <button onClick={onFix} className="min-h-11 text-sm text-mute transition hover:text-cream">
          משהו לא מדויק — לתקן
        </button>
      </div>
    </motion.div>
  );
}
