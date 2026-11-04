import { PLANS } from "@/lib/content";
import { isTranzilaBilling, listProviderCancels, recentPaymentEvents } from "@/lib/payments";
import { Card, PageHeader, when } from "@/components/admin/ui";
import { ProviderCancelList } from "@/components/admin/ProviderCancelList";
import { UpayEvents } from "@/components/admin/UpayEvents";
import { recentUpayEvents } from "@/lib/upay";

/** Payments: standing orders to stop in Tranzila, and every notification Tranzila sent. */
export default async function AdminPayments() {
  const open = listProviderCancels(false);
  const events = recentPaymentEvents(60);
  const upay = recentUpayEvents(60);
  return (
    <>
      <PageHeader eyebrow="סליקה" title="תשלומים" />
      <p className="-mt-2 mb-5 max-w-2xl text-sm text-mute">
        {isTranzilaBilling() ? "התשלום דרך טרנזילה פעיל." : "התשלום דרך טרנזילה עדיין כבוי (BILLING_PROVIDER אינו tranzila)."} מנויים מחויבים אוטומטית
        בהוראת קבע אצל טרנזילה. כשחבר/ה מבטל/ת או מוחק/ת חשבון, צריך לעצור את הוראת הקבע שלו/ה במערכת של טרנזילה ולסמן כאן שבוצע.
      </p>

      <Card title={`הוראות קבע לעצירה (טרנזילה / יופיי) (${open.length})`} className="mb-6">
        <ProviderCancelList initial={open.map((c) => ({ ...c, plan: PLANS[c.plan_type]?.title ?? c.plan_type, when: when(c.created_at) }))} />
      </Card>

      <Card title="הודעות מיופיי (מנוי חודשי)" className="mb-6">
        <p className="mb-3 text-[12.5px] text-mute">
          {process.env.UPAY_NOTIFY_KEY ? "החיבור ליופיי מוגדר." : "חסר המשתנה UPAY_NOTIFY_KEY ב־Railway — עד שיוגדר, כל ההודעות מיופיי נדחות."} Premium מופעל אוטומטית רק כשברור שהחיוב
          עבר, בסכום של ₪49, ממייל של משתמש קיים. כל השאר מחכה כאן להפעלה ידנית.
        </p>
        <UpayEvents
          initial={upay.map((e) => ({ id: e.id, accepted: !!e.accepted, note: e.note, txid: e.txid, email: e.email, sum: e.sum, userId: e.user_id, applied: !!e.applied_at, when: when(e.received_at), payload: e.payload, ip: e.source_ip }))}
        />
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
