"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Pencil, RotateCcw, X } from "lucide-react";
import { api } from "@/lib/client";
import type { CommunityQuestion, CommunityStatus } from "@/lib/community";
import { when } from "./ui";

export function QuestionReview({ initial, status }: { initial: CommunityQuestion[]; status: CommunityStatus }) {
  const [rows, setRows] = useState(initial);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function review(q: CommunityQuestion, next: CommunityStatus, text?: string) {
    setErr(null);
    try {
      await api(`/api/admin/questions/${q.id}`, { method: "PATCH", json: { status: next, ...(text ? { text } : {}) } });
      setRows((r) => r.filter((x) => x.id !== q.id));
      setEditing(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  if (!rows.length) return <p className="surface rounded-[20px] p-8 text-center text-sm text-mute">אין כאן שאלות כרגע.</p>;
  return (
    <>
      {err && <p className="mb-3 text-sm text-danger">{err}</p>}
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {rows.map((q) => (
            <motion.li key={q.id} layout exit={{ opacity: 0, x: 40 }} className="surface flex flex-col gap-3 rounded-2xl p-4 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                {editing === q.id ? (
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} maxLength={160} className="field text-[15px]" aria-label="עריכת השאלה" />
                ) : (
                  <p className="text-[15px] leading-relaxed">{q.text}</p>
                )}
                <p className="mt-1 text-xs text-mute-2">
                  {q.author ?? "חבר/ה שנמחק/ה"} · {when(q.created_at)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {editing === q.id ? (
                  <>
                    <button onClick={() => review(q, "approved", draft)} className="btn-gold px-4 py-2 text-sm">
                      <Check size={15} /> אישור עם עריכה
                    </button>
                    <button onClick={() => setEditing(null)} className="btn-ghost px-4 py-2 text-sm">
                      ביטול
                    </button>
                  </>
                ) : (
                  <>
                    {status !== "approved" && (
                      <button onClick={() => review(q, "approved")} className="btn-gold px-4 py-2 text-sm">
                        <Check size={15} /> אישור
                      </button>
                    )}
                    {status === "pending" && (
                      <button
                        onClick={() => {
                          setEditing(q.id);
                          setDraft(q.text);
                        }}
                        className="btn-ghost px-3 py-2 text-sm"
                        aria-label="עריכה ואישור"
                      >
                        <Pencil size={15} />
                      </button>
                    )}
                    {status !== "rejected" ? (
                      <button onClick={() => review(q, "rejected")} className="btn-ghost px-4 py-2 text-sm">
                        <X size={15} /> דחייה
                      </button>
                    ) : (
                      <button onClick={() => review(q, "pending")} className="btn-ghost px-4 py-2 text-sm">
                        <RotateCcw size={15} /> החזרה לבדיקה
                      </button>
                    )}
                  </>
                )}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </>
  );
}
