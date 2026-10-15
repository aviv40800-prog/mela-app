"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, RotateCcw } from "lucide-react";
import { api } from "@/lib/client";
import type { ReportRow } from "@/lib/safety";
import { Badge, when } from "./ui";

export function ReportReview({ initial, status, reasons }: { initial: ReportRow[]; status: "open" | "handled"; reasons: Record<string, string> }) {
  const [rows, setRows] = useState(initial);
  const [openChat, setOpenChat] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function mark(r: ReportRow) {
    setErr(null);
    try {
      await api(`/api/admin/reports/${r.id}`, { method: "PATCH", json: { status: status === "open" ? "handled" : "open" } });
      setRows((x) => x.filter((y) => y.id !== r.id));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  if (!rows.length) return <p className="surface rounded-[20px] p-8 text-center text-sm text-mute">{status === "open" ? "אין דיווחים פתוחים." : "אין כאן דיווחים."}</p>;
  return (
    <>
      {err && <p className="mb-3 text-sm text-danger">{err}</p>}
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {rows.map((r) => (
            <motion.li key={r.id} layout exit={{ opacity: 0, x: 40 }} className="surface rounded-2xl p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {r.reported_id ? (
                      <Link href={`/admin/users/${r.reported_id}`} className="font-semibold text-gold-2 hover:underline">
                        {r.reported_name ?? `משתמש #${r.reported_id}`}
                      </Link>
                    ) : (
                      <span className="text-mute">חשבון שנמחק</span>
                    )}
                    <Badge tone="red">{reasons[r.reason] ?? r.reason}</Badge>
                    {r.times_reported > 1 && <Badge tone="gold">דווח/ה {r.times_reported} פעמים</Badge>}
                    {!!r.reported_banned && <Badge tone="mute">מושעה</Badge>}
                  </div>
                  {r.details && <p className="text-[14.5px] leading-relaxed text-cream/90">״{r.details}״</p>}
                  <p className="text-[12.5px] text-mute">
                    דיווח/ה: {r.reporter_id ? <Link href={`/admin/users/${r.reporter_id}`} className="hover:text-cream">{r.reporter_name ?? `#${r.reporter_id}`}</Link> : "חשבון שנמחק"} · {when(r.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {r.chat.length > 0 && (
                    <button onClick={() => setOpenChat(openChat === r.id ? null : r.id)} className="flex items-center gap-1 rounded-full border border-line-2 px-3 py-1.5 text-[13px] text-mute hover:text-cream">
                      שיחה ({r.chat.length}) <ChevronDown size={14} className={openChat === r.id ? "rotate-180" : ""} />
                    </button>
                  )}
                  <button onClick={() => mark(r)} className="flex items-center gap-1 rounded-full border border-line-2 px-3 py-1.5 text-[13px] text-mute hover:text-cream">
                    {status === "open" ? <><Check size={14} /> סימון כטופל</> : <><RotateCcw size={14} /> החזרה לפתוחים</>}
                  </button>
                </div>
              </div>
              {openChat === r.id && (
                <div className="mt-3 max-h-80 space-y-1.5 overflow-y-auto rounded-xl border border-line bg-ink-2/60 p-3">
                  {r.chat.map((m, i) => {
                    const fromReported = m.sender_id === r.reported_id;
                    return (
                      <div key={i} className={`flex ${fromReported ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-xl px-3 py-2 text-[13.5px] ${fromReported ? "bg-danger/15" : "bg-fg/[0.06]"}`}>
                          <div className="mb-0.5 text-[11px] text-mute">
                            {fromReported ? r.reported_name ?? "המדווח/ת" : r.reporter_name ?? "מי שדיווח/ה"} · {when(m.sent_at)}
                          </div>
                          {m.text_content}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </>
  );
}
