import Link from "next/link";
import { countByStatus, listCommunityQuestions, type CommunityStatus } from "@/lib/community";
import { PageHeader } from "@/components/admin/ui";
import { QuestionReview } from "@/components/admin/QuestionReview";

const TABS: { key: CommunityStatus; label: string }[] = [
  { key: "pending", label: "ממתינות" },
  { key: "approved", label: "מאושרות" },
  { key: "rejected", label: "נדחו" },
];

/** Questions members suggested in the "what would you ask?" pause. Approved ones become chat ideas. */
export default async function AdminQuestions({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: raw } = await searchParams;
  const status = (TABS.some((t) => t.key === raw) ? raw : "pending") as CommunityStatus;
  const counts = countByStatus();
  const rows = listCommunityQuestions(status);
  return (
    <>
      <PageHeader eyebrow="מנוע השאלות הקהילתי" title="שאלות מהקהילה" />
      <p className="-mt-2 mb-5 max-w-2xl text-sm text-mute">שאלות שחברים הציעו בהפוגות העניין. שאלות שמאושרות מופיעות כ״רעיון לשאלה״ בצ׳אטים וכהשראה בהפוגות הבאות.</p>
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/questions?status=${t.key}`}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] transition ${t.key === status ? "bg-gold font-semibold text-[#2a0a0c]" : "border border-line-2 text-mute hover:text-cream"}`}
          >
            {t.label} <span className="tabular">({counts[t.key]})</span>
          </Link>
        ))}
      </div>
      <QuestionReview key={status} initial={rows} status={status} />
    </>
  );
}
