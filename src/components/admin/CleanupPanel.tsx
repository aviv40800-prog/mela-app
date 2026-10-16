"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { api } from "@/lib/client";

type Row = { id: number; name: string; full: boolean; sub: string; admin: boolean };

/** Going live: remove all demo members, or tick test accounts (shift-click selects a range) and delete them. */
export function CleanupPanel({ mode, rows, demoCount }: { mode: "demo" | "real"; rows: Row[]; demoCount: number }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [anchor, setAnchor] = useState<number | null>(null);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function toggle(i: number, shift: boolean) {
    const next = new Set(picked);
    if (shift && anchor !== null) {
      const [a, b] = anchor < i ? [anchor, i] : [i, anchor];
      for (let k = a; k <= b; k++) if (!rows[k].admin) next.add(rows[k].id);
    } else if (next.has(rows[i].id)) next.delete(rows[i].id);
    else next.add(rows[i].id);
    setPicked(next);
    setAnchor(i);
  }

  async function run(body: object) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await api<{ removed?: number; deleted?: number[]; skipped?: { id: number; reason: string }[] }>("/api/admin/cleanup", { method: "POST", json: { ...body, confirm: word.trim() } });
      setMsg(r.removed !== undefined ? `נמחקו ${r.removed} משתמשי דמו. הם לא ייווצרו מחדש.` : `נמחקו ${r.deleted?.length ?? 0} משתמשים${r.skipped?.length ? ` (${r.skipped.length} דולגו)` : ""}.`);
      setPicked(new Set());
      setWord("");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const confirmed = word.trim() === "מחיקה";
  const confirmBox = (
    <label className="flex flex-wrap items-center gap-2 text-[13px] text-mute">
      להמשך, הקלידו <b className="text-cream">מחיקה</b>:
      <input value={word} onChange={(e) => setWord(e.target.value)} className="field h-10 w-32 !py-0 text-sm" aria-label="אישור מחיקה" />
    </label>
  );

  if (mode === "demo")
    return (
      <section className="surface mt-5 rounded-[20px] border border-danger/25 p-4">
        <h2 className="text-[15px] font-semibold">יציאה לאוויר: מחיקת כל משתמשי הדמו</h2>
        <p className="mt-1 text-[13px] text-mute">מוחק את כל {demoCount} משתמשי הדמו, ההתאמות וההודעות שלהם. אחרי המחיקה הם לא ייווצרו מחדש. אין דרך לשחזר.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {confirmBox}
          <button onClick={() => run({ action: "remove_demo" })} disabled={!confirmed || busy || demoCount === 0} className="btn-ghost border-danger/50 py-2.5 text-sm text-danger disabled:opacity-40">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} מחיקת {demoCount} משתמשי דמו
          </button>
        </div>
        {msg && <p className="mt-3 text-sm text-gold-2">{msg}</p>}
        {err && <p className="mt-3 text-sm text-danger">{err}</p>}
      </section>
    );

  return (
    <details className="surface mt-5 rounded-[20px] border border-danger/25 p-4">
      <summary className="cursor-pointer text-[15px] font-semibold">מחיקת משתמשי ניסיון</summary>
      <p className="mt-1 text-[13px] text-mute">סמנו את החשבונות למחיקה. לחיצה על משתמש אחד, ואחר כך Shift + לחיצה על משתמש אחר, מסמנת את כל מי שביניהם. חשבונות מנהל לא נמחקים.</p>
      <ul className="mt-3 max-h-[420px] divide-y divide-line/60 overflow-y-auto rounded-xl border border-line">
        {rows.map((r, i) => (
          <li key={r.id}>
            <label className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${picked.has(r.id) ? "bg-danger/[0.08]" : ""} ${r.admin ? "opacity-50" : ""}`}>
              <input
                type="checkbox"
                disabled={r.admin}
                checked={picked.has(r.id)}
                onChange={() => {}}
                onClick={(e) => toggle(i, e.shiftKey)}
                className="h-4 w-4 accent-[#ff4d5a]"
              />
              <span className="tabular w-6 text-mute-2">{i + 1}</span>
              <span className="font-medium">{r.name}</span>
              <span className="truncate text-mute">{r.sub}</span>
              {r.admin && <span className="ms-auto text-[12px] text-gold-2">מנהל</span>}
            </label>
          </li>
        ))}
      </ul>
      {picked.size > 0 && (
        <p className="mt-3 text-[13px] text-cream">
          נבחרו {picked.size}: {rows.filter((r) => picked.has(r.id)).map((r) => (r.full ? r.name : r.sub.split(" · ")[0])).join(", ")}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {confirmBox}
        <button onClick={() => run({ action: "delete_users", ids: [...picked] })} disabled={!confirmed || busy || picked.size === 0} className="btn-ghost border-danger/50 py-2.5 text-sm text-danger disabled:opacity-40">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} מחיקת {picked.size} נבחרים
        </button>
      </div>
      {msg && <p className="mt-3 text-sm text-gold-2">{msg}</p>}
      {err && <p className="mt-3 text-sm text-danger">{err}</p>}
    </details>
  );
}
