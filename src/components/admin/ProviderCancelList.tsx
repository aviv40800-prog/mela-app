"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { api } from "@/lib/client";

type Row = { id: number; user_id: number | null; label: string; plan: string; last4: string | null; reason: "canceled" | "deleted"; when: string };

export function ProviderCancelList({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  async function done(id: number) {
    try {
      await api(`/api/admin/provider-cancels/${id}`, { method: "PATCH" });
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  if (!rows.length) return <p className="text-sm text-mute">אין הוראות קבע שממתינות לעצירה.</p>;
  return (
    <>
      {err && <p className="mb-2 text-sm text-danger">{err}</p>}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3 text-[13.5px]">
            <div className="min-w-0 flex-1">
              {r.user_id ? (
                <Link href={`/admin/users/${r.user_id}`} className="font-semibold text-gold-2 hover:underline">
                  {r.label}
                </Link>
              ) : (
                <span className="font-semibold">{r.label}</span>
              )}
              <div className="text-[12.5px] text-mute">
                {r.plan}
                {r.last4 && <> · כרטיס שמסתיים ב־<span dir="ltr">{r.last4}</span></>} · {r.reason === "deleted" ? "מחק/ה את החשבון" : "ביטל/ה את המנוי"} · {r.when}
              </div>
            </div>
            <button onClick={() => done(r.id)} className="flex items-center gap-1 rounded-full border border-line-2 px-3 py-1.5 text-[13px] text-mute hover:text-cream">
              <Check size={14} /> נעצר בטרנזילה
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
