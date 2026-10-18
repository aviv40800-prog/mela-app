"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { ArrowLeft, Camera, Check, Loader2, PenLine, RefreshCw } from "lucide-react";
import { api, haptic } from "@/lib/client";
import { compressImage, uploadPhoto } from "@/lib/upload";
import { CULTURAL_PROMPTS, LOOKING_FOR, MARITAL_STATUS, RELIGIOSITY } from "@/lib/content";
import type { ChatView, Draft } from "@/lib/ai-onboarding";
import { SignOutButton } from "./SignOutButton";

const TOTAL = 13; // FIELD_ORDER.length
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
  const scroller = useRef<HTMLElement>(null);
  const vp = useVisualViewport();
  const done = TOTAL - chat.missing.length;

  // Keep the latest message in view (also when the keyboard opens and the visible area shrinks).
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [chat.messages.length, busy, chat.ask, err, vp.height]);

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
    <div
      className="fixed inset-x-0 top-0 z-20 mx-auto flex w-full max-w-md flex-col bg-ink"
      style={{ height: vp.height ? `${vp.height}px` : "100dvh", transform: vp.top ? `translateY(${vp.top}px)` : undefined }}
    >
      {/* header: host + what was learned so far */}
      <header className="shrink-0 border-b border-line bg-ink/95 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <motion.svg width="28" height="26" viewBox="0 0 240 216" aria-hidden="true" animate={busy ? { scale: [1, 1.08, 1] } : { scale: 1 }} transition={{ duration: 1, repeat: busy ? Infinity : 0 }}>
              <path d={HEART} fill="rgb(229 56 59 / 0.25)" stroke="#ff5a63" strokeWidth="14" />
            </motion.svg>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[15px] font-semibold">המארחת של MELA</div>
              <div className="truncate text-[12px] text-mute">{busy ? "מקלידה…" : "מכירה אותך · בדרך כלל עונה מיד"}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Link href="/onboarding/profile" className="rounded-full border border-gold/30 px-3 py-1.5 text-[12.5px] text-cream/90 transition hover:border-gold/60">
              להשלים בטופס
            </Link>
            <SignOutButton />
          </div>
        </div>
        <section aria-label="מה שלמדתי עלייך" className="mt-3 rounded-2xl border border-gold/30 bg-gradient-to-b from-gold/[0.1] to-gold/[0.03] px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12.5px] font-medium text-gold-3">{done ? "מה שלמדתי עלייך" : "הפרופיל שלך ייבנה כאן תוך כדי שיחה"}</span>
            <span className="tabular text-[11.5px] text-mute">
              {done} / {TOTAL}
            </span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-fg/10">
            <motion.div className="h-full rounded-full bg-gradient-to-l from-gold-3 to-rose" animate={{ width: `${(done / TOTAL) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
          </div>
          {facts(chat.draft).length > 0 && (
            <LayoutGroup>
              <motion.div layout className="no-scrollbar -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1">
                <AnimatePresence initial={false}>
                  {facts(chat.draft).map((f) => (
                    <motion.span
                      key={f.key + f.label}
                      layout
                      initial={{ opacity: 0, y: 18, scale: 0.7 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ type: "spring", stiffness: 380, damping: 26 }}
                      className="shrink-0 rounded-full border border-gold/25 bg-fg/[0.06] px-2.5 py-1 text-[12px] whitespace-nowrap"
                    >
                      {f.label}
                    </motion.span>
                  ))}
                </AnimatePresence>
              </motion.div>
            </LayoutGroup>
          )}
        </section>
      </header>

      {/* conversation — the only part that scrolls */}
      <main ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite">
        <p className="mb-3 text-center text-[11px] leading-relaxed text-mute-2">השיחה מעובדת בעזרת בינה מלאכותית (Claude של Anthropic) רק כדי לבנות את הפרופיל שלך. כל פרט אפשר לערוך לפני השמירה.</p>
        <div className="flex flex-col gap-2.5">
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
          {!busy && chat.ask === "details" && chat.details.length > 0 && <DetailsCard rows={chat.details} onDone={(details, summary) => send({ details }, summary)} />}
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
        </div>
      </main>

      {/* composer — anchored to the bottom of the visible screen, above the home indicator / keyboard */}
      {!chat.done && chat.ask !== "photos" && chat.ask !== "details" && !(chat.ask === "bio" && chat.draft.bio_draft) && (
        <footer className="shrink-0 border-t border-line bg-ink/95 px-4 pt-2.5 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur-xl">
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
                    className="min-h-11 rounded-2xl border border-gold/35 bg-gold/[0.08] px-3 py-2 text-[14px] leading-snug text-gold-3 transition hover:border-gold/70"
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
              enterKeyHint="send"
              placeholder={chat.messages.length <= 2 ? "למשל: אני דנה, 27, אחות ממודיעין…" : "כתבו בחופשיות…"}
              className="min-w-0 flex-1 bg-transparent py-2.5 text-[16px] outline-none placeholder:text-mute-2"
            />
            <button disabled={busy || !text.trim()} aria-label="שליחה" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#ff6670] to-[#c4152a] text-white transition disabled:opacity-40">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowLeft size={19} />}
            </button>
          </form>
        </footer>
      )}
    </div>
  );
}

/** The visible viewport (shrinks when the on-screen keyboard opens) so the composer stays above it, iOS included. */
function useVisualViewport() {
  const [vp, setVp] = useState<{ height: number; top: number }>({ height: 0, top: 0 });
  useEffect(() => {
    const v = window.visualViewport;
    if (!v) return;
    const update = () => setVp({ height: Math.round(v.height), top: Math.round(v.offsetTop) });
    update();
    v.addEventListener("resize", update);
    v.addEventListener("scroll", update);
    return () => {
      v.removeEventListener("resize", update);
      v.removeEventListener("scroll", update);
    };
  }, []);
  return vp;
}

/** Quick details in one card: a row of chips per question, then one tap to continue. */
function DetailsCard({ rows, onDone }: { rows: ChatView["details"]; onDone: (details: Record<string, string>, summary: string) => void }) {
  const [picked, setPicked] = useState<Record<string, string>>({});
  const complete = rows.every((r) => picked[r.field]);
  const summary = rows.map((r) => r.options.find((o) => o.value === picked[r.field])?.label).filter(Boolean).join(" · ");
  return (
    <motion.div {...bubbleIn} className="flex flex-col gap-3.5 rounded-[20px] border border-gold/30 bg-fg/[0.04] p-3.5" role="group" aria-label="פרטים בלחיצה">
      {rows.map((r, ri) => (
        <motion.fieldset key={r.field} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: ri * 0.06 } }}>
          <legend className="mb-1.5 text-[12.5px] text-gold-3">{r.label}</legend>
          <div className="flex flex-wrap gap-1.5">
            {r.options.map((o) => {
              const on = picked[r.field] === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    haptic(4);
                    setPicked((p) => ({ ...p, [r.field]: o.value }));
                  }}
                  className={`flex min-h-10 items-center gap-1 rounded-full border px-3.5 py-1.5 text-[14px] transition ${
                    on ? "border-gold bg-gold/25 text-cream" : "border-gold/30 bg-gold/[0.06] text-gold-3 hover:border-gold/60"
                  }`}
                >
                  {on && <Check size={14} strokeWidth={2.6} />}
                  {o.label}
                </button>
              );
            })}
          </div>
        </motion.fieldset>
      ))}
      <button onClick={() => complete && onDone(picked, summary)} disabled={!complete} className="btn-gold w-full !py-3 text-[15px] disabled:opacity-40">
        המשך
      </button>
    </motion.div>
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
