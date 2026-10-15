import { PLANS } from "@/lib/content";
import { isTranzilaBilling, listProviderCancels, recentPaymentEvents } from "@/lib/payments";
import { Card, PageHeader, when } from "@/components/admin/ui";
import { ProviderCancelList } from "@/components/admin/ProviderCancelList";

/** Payments: standing orders to stop in Tranzila, and every notification Tranzila sent. */
export default async function AdminPayments() {
  const open = listProviderCancels(false);
  const events = recentPaymentEvents(60);
  return (
    <>
      <PageHeader eyebrow="סליקה" title="תשלומים" />
      <p className="-mt-2 mb-5 max-w-2xl text-sm text-mute">
        {isTranzilaBilling() ? "התשלום דרך טרנזילה פעיל." : "התשלום דרך טרנזילה עדיין כבוי (BILLING_PROVIDER אינו tranzila)."} מנויים מחויבים אוטומטית
        בהוראת קבע אצל טרנזילה. כשחבר/ה מבטל/ת או מוחק/ת חשבון, צריך לעצור את הוראת הקבע שלו/ה במערכת של טרנזילה ולסמן כאן שבוצע.
      </p>

      <Card title={`הוראות קבע לעצירה בטרנזילה (${open.length})`} className="mb-6">
        <ProviderCancelList initial={open.map((c) => ({ ...c, plan: PLANS[c.plan_type]?.title ?? c.plan_type, when: when(c.created_at) }))} />
      </Card>

      <Card title="הודעות אחרונות מטרנזילה">
        {events.length === 0 ? (
          <p className="text-sm text-mute">עוד לא התקבלו הודעות.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => (
              <li key={e.id} className="rounded-xl border border-line p-3 text-[13px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={e.accepted ? "font-semibold text-[#7fd89a]" : "font-semibold text-danger"}>{e.accepted ? "התקבל" : "נדחה"}</span>
                  <span className="text-cream/85">{e.note}</span>
                  <span className="ms-auto text-mute">
                    {e.source_ip && <span dir="ltr">IP {e.source_ip} · </span>}
                    {when(e.received_at)}
                  </span>
                </div>
                <pre dir="ltr" className="mt-2 overflow-x-auto rounded-lg bg-ink-2/70 p-2 text-[11.5px] text-mute">
                  {JSON.stringify(JSON.parse(e.payload), null, 1)}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
