"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/client";
import { Toggle } from "../ui/Toggle";

const SEEKING = [
  ["male", "גבר"],
  ["female", "אישה"],
  ["everyone", "כולם"],
] as const;

export function AdminUserActions({
  userId,
  verified,
  banned,
  hasSub,
  seeking,
}: {
  userId: number;
  verified: boolean;
  banned: boolean;
  hasSub: boolean;
  seeking: "male" | "female" | "everyone";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function patch(key: string, body: object) {
    setBusy(key);
    setErr(null);
    try {
      await api(`/api/admin/users/${userId}`, { method: "PATCH", json: body });
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    try {
      await api(`/api/admin/users/${userId}`, { method: "DELETE" });
      router.replace("/admin/users");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <section className="surface rounded-[22px] p-5">
      <h2 className="mb-4 text-[15px] font-semibold">פעולות</h2>
      <div className="space-y-4">
        <Row title="פרופיל מאומת" sub="תג האימות הזהב בכרטיס">
          <Toggle label="פרופיל מאומת" checked={verified} onChange={(v) => patch("verify", { is_verified: v })} />
        </Row>
        <Row title="השעיית חשבון" sub="מנתק ומסתיר מהגילוי">
          <Toggle label="השעיית חשבון" checked={banned} onChange={(v) => patch("ban", { is_banned: v })} />
        </Row>
        <Row title="מחפש/ת" sub="את מי רואים במסך הגילוי ומי רואה אותם">
          <div className="flex gap-1" role="radiogroup" aria-label="מחפש/ת">
            {SEEKING.map(([v, label]) => (
              <button
                key={v}
                role="radio"
                aria-checked={seeking === v}
                disabled={!!busy || seeking === v}
                onClick={() => patch("seeking", { seeking: v })}
                className={`rounded-full border px-3 py-1.5 text-[12.5px] transition ${seeking === v ? "border-gold bg-gold/20 text-cream" : "border-line text-mute hover:border-gold/50"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </Row>
      </div>

      <div className="hairline my-5" />
      <div className="grid grid-cols-2 gap-2 text-sm">
        <button onClick={() => patch("trial", { subscription: "extend_trial_7" })} className="btn-ghost py-2.5 text-[13px]" disabled={!!busy}>
          {busy === "trial" ? <Loader2 size={15} className="animate-spin" /> : "+7 ימי ניסיון"}
        </button>
        <button onClick={() => patch("month", { subscription: "grant_month" })} className="btn-ghost py-2.5 text-[13px]" disabled={!!busy}>
          {busy === "month" ? <Loader2 size={15} className="animate-spin" /> : "חודש מתנה"}
        </button>
        {hasSub && (
          <button onClick={() => patch("cancel", { subscription: "cancel" })} className="btn-ghost col-span-2 py-2.5 text-[13px] text-mute" disabled={!!busy}>
            {busy === "cancel" ? <Loader2 size={15} className="animate-spin" /> : "ביטול מנוי"}
          </button>
        )}
      </div>

      <div className="hairline my-5" />
      {confirmDelete ? (
        <div className="rounded-2xl border border-danger/30 bg-danger/[0.05] p-3 text-sm">
          <p>למחוק לצמיתות? יימחקו גם ההתאמות, ההודעות והמנוי. אין דרך לשחזר.</p>
          <div className="mt-3 flex gap-2">
            <button onClick={remove} className="btn-ghost flex-1 border-danger/40 py-2 text-[13px] text-danger" disabled={!!busy}>
              {busy === "delete" ? <Loader2 size={15} className="animate-spin" /> : "כן, למחוק"}
            </button>
            <button onClick={() => setConfirmDelete(false)} className="btn-ghost flex-1 py-2 text-[13px]">
              ביטול
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setConfirmDelete(true)} className="w-full py-1 text-center text-[13px] text-danger/80 hover:text-danger">
          מחיקת משתמש
        </button>
      )}
      {err && <p className="mt-3 text-sm text-danger">{err}</p>}
    </section>
  );
}

function Row({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-sm">{title}</div>
        <div className="text-[12px] text-mute">{sub}</div>
      </div>
      {children}
    </div>
  );
}
