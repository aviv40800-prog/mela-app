import { PageHeader } from "@/components/admin/ui";
import { SuggestionQueue } from "@/components/admin/SuggestionQueue";
import { pendingQueue } from "@/lib/auto-suggest";

/** The AI matchmaker's nightly drafts: approve (optionally edit), or reject. Nothing is sent without the team. */
export default function AdminSuggestions() {
  return (
    <>
      <PageHeader eyebrow="שדכנית AI" title="הצעות שמחכות לאישור" />
      <p className="-mt-2 mb-5 max-w-2xl text-sm text-mute">
        כל ערב ה־AI בוחר לחברים פעילים את מי שהכי מתאים להם (לפי מה שענו, למי עשו לייק ומי צפוי להחזיר לייק) ומנסח נימוק. שום דבר לא נשלח בלי אישור שלך.
      </p>
      <SuggestionQueue initial={pendingQueue()} />
    </>
  );
}
