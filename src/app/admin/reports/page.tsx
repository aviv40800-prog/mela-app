import Link from "next/link";
import { db } from "@/lib/db";
import { REPORT_REASONS, listReports } from "@/lib/safety";
import { PageHeader } from "@/components/admin/ui";
import { ReportReview } from "@/components/admin/ReportReview";

const TABS = [
  { key: "open", label: "פתוחים" },
  { key: "handled", label: "טופלו" },
] as const;

/** Member reports. Suspending someone is done from their user page. */
export default async function AdminReports({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: raw } = await searchParams;
  const status = raw === "handled" ? "handled" : "open";
  const counts = Object.fromEntries(
    (db.prepare("SELECT status, COUNT(*) AS n FROM reports GROUP BY status").all() as { status: string; n: number }[]).map((r) => [r.status, r.n]),
  );
  return (
    <>
      <PageHeader eyebrow="בטיחות הקהילה" title="דיווחים" />
      <p className="-mt-2 mb-5 max-w-2xl text-sm text-mute">
        דיווחים שחברים שלחו על משתמשים אחרים. השיחה ביניהם נשמרת בדיווח גם אם נחסמו. להשעיה או מחיקה, פותחים את עמוד המשתמש.
      </p>
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/reports?status=${t.key}`}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] transition ${t.key === status ? "bg-gold font-semibold text-[#2a0a0c]" : "border border-line-2 text-mute hover:text-cream"}`}
          >
            {t.label} <span className="tabular">({counts[t.key] ?? 0})</span>
          </Link>
        ))}
      </div>
      <ReportReview key={status} initial={listReports(status)} status={status} reasons={REPORT_REASONS} />
    </>
  );
}
