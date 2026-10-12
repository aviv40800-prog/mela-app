import Link from "next/link";
import { Photo } from "../Photo";

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="font-display mt-1 text-3xl font-bold">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function Card({ title, action, children, className = "" }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`surface rounded-[22px] p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** KPI tile: one number, a label, an optional quiet sub-line. */
export function Stat({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="surface rounded-[20px] p-4">
      <div className="text-[12px] text-mute">{label}</div>
      <div className={`tabular mt-1.5 text-[1.75rem] leading-none font-bold ${accent ? "text-gold-2" : ""}`}>{value}</div>
      {sub && <div className="mt-2 text-[11.5px] text-mute-2">{sub}</div>}
    </div>
  );
}

export function Badge({ tone = "mute", children }: { tone?: "gold" | "green" | "red" | "mute"; children: React.ReactNode }) {
  const tones = {
    gold: "bg-gold/12 text-gold-2",
    green: "bg-success/12 text-success",
    red: "bg-danger/12 text-danger",
    mute: "bg-white/[0.06] text-mute",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

export const SUB_BADGE: Record<string, { label: string; tone: "gold" | "green" | "red" | "mute" }> = {
  trialing: { label: "ניסיון", tone: "gold" },
  active: { label: "פעיל", tone: "green" },
  canceled: { label: "בוטל", tone: "mute" },
  past_due: { label: "חוב", tone: "red" },
};

export function UserChip({ id, name, photo, sub }: { id: number; name: string | null; photo?: string | null; sub?: string }) {
  return (
    <Link href={`/admin/users/${id}`} className="group flex min-w-0 items-center gap-3">
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full">
        <Photo src={photo} name={name || "?"} className="h-full w-full" rounded="rounded-full" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm group-hover:text-gold-2">{name || "ללא שם"}</div>
        {sub && <div className="truncate text-[11.5px] text-mute">{sub}</div>}
      </div>
    </Link>
  );
}

const TZ = "Asia/Jerusalem";
export function when(s: string | null | undefined) {
  if (!s) return "—";
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "עכשיו";
  if (mins < 60) return `לפני ${mins} דק׳`;
  if (mins < 60 * 24) return `לפני ${Math.round(mins / 60)} שע׳`;
  if (mins < 60 * 24 * 7) return `לפני ${Math.round(mins / 1440)} ימים`;
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "2-digit", timeZone: TZ });
}
