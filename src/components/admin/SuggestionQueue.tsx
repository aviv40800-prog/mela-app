"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Crown, Loader2, Sparkles, X } from "lucide-react";
import { Photo } from "../Photo";
import { api } from "@/lib/client";
import type { Person, QueueItem } from "@/lib/auto-suggest";

function Side({ p }: { p: Person }) {
  return (
    <Link href={`/admin/users/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
      <Photo src={p.photo} name={p.name} rounded="rounded-full" className="h-12 w-12 shrink-0" />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 truncate text-[15px] font-semibold">
          {p.name.split(" ")[0]} {p.age && <span className="font-normal text-mute">{p.age}</span>}
          {p.premium && <Crown size={13} className="shrink-0 text-gold-2" aria-label="Premium" />}
        </span>
        <span className="block truncate text-[12.5px] text-mute">{p.location}</span>
      </span>
    </Link>
  );
}

function Row({ item, onDone }: { item: QueueItem; onDone: (id: number, msg: string) => void }) {
  const [noteA, setNoteA] = useState(item.noteA);
  const [noteB, setNoteB] = useState(item.noteB);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    setBusy(action);
    setErr(null);
    try {
      await api("/api/admin/suggestions/queue", { method: "POST", json: action === "approve" ? { action, id: item.id, noteA, noteB } : { action, id: item.id } });
      onDone(item.id, action === "approve" ? `נשלח ל${item.member.name.split(" ")[0]} ול${item.candidate.name.split(" ")[0]} 💛` : "נדחה");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const field = "field mt-1 w-full resize-none text-[14px] leading-relaxed";
  return (
    <motion.div layout exit={{ opacity: 0, height: 0 }} className="surface overflow-hidden rounded-[20px] p-4">
      <div className="flex items-center gap-3">
        <Side p={item.member} />
        <span className="shrink-0 rounded-full bg-gold/12 px-2.5 py-1 text-[12px] font-bold text-gold-2 tabular">{Math.round(item.score)}%</span>
        <Side p={item.candidate} />
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-mute">{item.why}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-[12.5px] text-mute">
          {item.ai && <Sparkles size={12} className="me-1 inline text-gold-2" />}
          מה {item.member.name.split(" ")[0]} יקבל/תקבל
          <textarea value={noteA} onChange={(e) => setNoteA(e.target.value)} rows={3} maxLength={600} className={field} />
        </label>
        <label className="text-[12.5px] text-mute">
          {item.ai && <Sparkles size={12} className="me-1 inline text-gold-2" />}
          מה {item.candidate.name.split(" ")[0]} יקבל/תקבל
          <textarea value={noteB} onChange={(e) => setNoteB(e.target.value)} rows={3} maxLength={600} className={field} />
        </label>
      </div>
      {err && <p className="mt-2 text-sm text-danger">{err}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={() => act("approve")} disabled={!!busy} className="btn-gold flex-1 py-2.5 text-sm">
          {busy === "approve" ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} אישור ושליחה
        </button>
        <button onClick={() => act("reject")} disabled={!!busy} className="btn-ghost py-2.5 text-sm">
          {busy === "reject" ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />} דחייה
        </button>
      </div>
    </motion.div>
  );
}

export function SuggestionQueue({ initial }: { initial: QueueItem[] }) {
  const [items, setItems] = useState(initial);
  const [toast, setToast] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  function done(id: number, msg: string) {
    setItems((xs) => xs.filter((x) => x.id !== id));
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function generate() {
    setGenerating(true);
    try {
      const r = await api<{ created: number; items: QueueItem[] }>("/api/admin/suggestions/queue", { method: "POST", json: { action: "generate" } });
      setItems(r.items);
      setToast(r.created ? `נוספו ${r.created} הצעות חדשות` : "אין כרגע זוגות חדשים להציע");
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="tabular text-sm text-mute">{items.length} מחכות לאישור</span>
        <button onClick={generate} disabled={generating} className="btn-ghost py-2 text-sm">
          {generating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {generating ? "ה־AI עובד… (עד כמה דקות)" : "להכין הצעות עכשיו"}
        </button>
      </div>
      {items.length === 0 && <div className="surface rounded-[20px] p-6 text-center text-sm text-mute">אין הצעות שמחכות. ה־AI יכין חדשות הערב (מ־19:00), או בכפתור למעלה.</div>}
      <AnimatePresence initial={false}>
        {items.map((it) => (
          <Row key={it.id} item={it} onDone={done} />
        ))}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed inset-x-0 bottom-6 z-50 mx-auto w-fit rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-[#2a1c12] shadow-lg">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
