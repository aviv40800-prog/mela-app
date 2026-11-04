"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/client";

type Row = { id: number; accepted: boolean; note: string; txid: string | null; email: string | null; sum: number | null; userId: number | null; applied: boolean; when: string; payload: string; ip: string | null };

function ApplyForm({ row, onDone }: { row: Row; onDone: (name: string, userId: number) => void }) {
  const [member, setMember] = useState(row.email ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function apply() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ userId: number; name: string | null }>("/api/admin/upay", { method: "POST", json: { eventId: row.id, member } });
      onDone(r.name ?? `#${r.userId}`, r.userId);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input value={member} onChange={(e) => setMember(e.target.value)} dir="ltr" placeholder="מייל או מספר משתמש" className="field !py-1.5 text-[13px]" />
      <button onClick={apply} disabled={busy || !member.trim()} className="btn-gold !py-1.5 text-[13px]">
        {busy ? <Loader2 size={14} className="animate-spin" /> : null} הפעלת Premium לחודש
      </button>
      {err && <span className="text-[12.5px] text-danger">{err}</span>}
    </div>
  );
}

export function UpayEvents({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial);
  if (!rows.length) return <p className="text-sm text-mute">עוד לא התקבלו הודעות מיופיי.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((e) => (
        <li key={e.id} className="rounded-xl border border-line p-3 text-[13px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className={e.applied ? "font-semibold text-[#7fd89a]" : e.accepted ? "font-semibold text-gold-2" : "font-semibold text-danger"}>
              {e.applied ? "Premium הופעל" : e.accepted ? "התקבל" : "נדחה"}
            </span>
            <span className="text-cream/85">{e.note}</span>
            {e.sum != null && <span className="tabular">₪{e.sum}</span>}
            {e.email && <span dir="ltr" className="text-mute">{e.email}</span>}
            {e.userId && (
              <Link href={`/admin/users/${e.userId}`} className="text-gold-2 hover:underline">
                למשתמש
              </Link>
            )}
            <span className="ms-auto text-mute">
              {e.ip && <span dir="ltr">IP {e.ip} · </span>}
              {e.when}
            </span>
          </div>
          {e.accepted && !e.applied && (
            <ApplyForm row={e} onDone={(name, userId) => setRows((rs) => rs.map((x) => (x.id === e.id ? { ...x, applied: true, userId, note: `הופעל ידנית ל${name}` } : x)))} />
          )}
          <pre dir="ltr" className="mt-2 overflow-x-auto rounded-lg bg-ink-2/70 p-2 text-[11.5px] text-mute">
            {JSON.stringify(JSON.parse(e.payload), null, 1)}
          </pre>
        </li>
      ))}
    </ul>
  );
}
