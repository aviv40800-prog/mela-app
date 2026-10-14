import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { overview, recentMatches, recentSignups, recentWebhooks, signupsByDay } from "@/lib/admin-data";
import { SignupsChart } from "@/components/admin/SignupsChart";
import { Badge, Card, PageHeader, Stat, SUB_BADGE, UserChip, when } from "@/components/admin/ui";

const ils = (n: number) => `₪${n.toLocaleString("he-IL")}`;

export default function AdminOverview() {
  const o = overview();
  const series = signupsByDay(14);
  const signups = recentSignups(8);
  const matches = recentMatches(6);
  const hooks = recentWebhooks(6);

  return (
    <>
      <PageHeader eyebrow="לוח בקרה" title="סקירה כללית">
        <Link href="/admin/users" className="btn-ghost py-2.5 text-sm">
          לכל המשתמשים <ArrowLeft size={15} />
        </Link>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="משתמשים אמיתיים" value={o.users} sub={`+${o.new7d} השבוע · +${o.newToday} היום`} accent />
        <Stat label="פעילים (7 ימים)" value={o.active7d} sub={o.users ? `${Math.round((o.active7d / o.users) * 100)}% מהמשתמשים` : undefined} />
        <Stat label="MRR (מנויים פעילים)" value={ils(o.mrr)} sub={`+${ils(o.trialMrr)} אם כל הניסיונות יומרו`} />
        <Stat label="התאמות" value={o.matches} sub={`+${o.matches7d} השבוע`} />
        <Stat label="חינמיים / Premium" value={`${o.freeUsers} / ${o.premiumNow}`} sub={`המרה ל־Premium: ${o.conversion}%`} />
        <Stat label="מיצו את הלייקים היום" value={o.likeLimitHitsToday} sub="חינמיים שהגיעו למכסה — קהל חם לשדרוג" />
        <Stat label="לייקים / הודעות (24ש׳)" value={`${o.likes24h} / ${o.messages24h}`} />
        <Stat label="פרופילים חלקיים" value={o.incomplete} sub={`${o.demoUsers} פרופילי דמו · ${o.banned} מושעים`} />
      </div>

      {o.webhookFailures7d > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-danger/30 bg-danger/[0.06] px-4 py-3 text-sm text-danger">
          <AlertTriangle size={16} /> {o.webhookFailures7d} שליחות וואטסאפ נכשלו השבוע — בדקו את הגדרות ה־webhook.
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card title="הרשמות ב־14 הימים האחרונים" className="lg:col-span-2">
          <SignupsChart data={series} />
        </Card>
        <Card title="מנויים">
          <ul className="space-y-3 text-sm">
            {[
              ["trialing", o.trialing],
              ["active", o.active],
              ["canceled", o.canceled],
              ["past_due", o.pastDue],
            ].map(([k, v]) => (
              <li key={k} className="flex items-center justify-between">
                <Badge tone={SUB_BADGE[k as string].tone}>{SUB_BADGE[k as string].label}</Badge>
                <span className="tabular font-semibold">{v}</span>
              </li>
            ))}
          </ul>
          <div className="hairline my-4" />
          <p className="text-[12px] leading-relaxed text-mute">
            ה־MRR מחושב לפי ₪49 לחודשי ו־₪119/3 לרבעוני. החיוב עצמו עדיין במצב הדמיה (BILLING_PROVIDER=mock).
          </p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="נרשמו לאחרונה" action={<Link href="/admin/users?filter=real" className="text-xs text-gold-2 hover:underline">הכל</Link>}>
          {signups.length === 0 ? (
            <p className="text-sm text-mute">עוד אין הרשמות אמיתיות.</p>
          ) : (
            <ul className="space-y-3">
              {signups.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-2">
                  <UserChip id={u.id} name={u.full_name} photo={u.photo} sub={u.location ?? u.email ?? u.phone_number ?? ""} />
                  <span className="shrink-0 text-[11px] text-mute-2">{when(u.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="התאמות אחרונות">
          {matches.length === 0 ? (
            <p className="text-sm text-mute">עוד אין התאמות.</p>
          ) : (
            <ul className="space-y-3">
              {matches.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">
                    <Link href={`/admin/users/${m.a.id}`} className="hover:text-gold-2">{m.a.full_name}</Link>
                    <span className="mx-1.5 text-gold">♥</span>
                    <Link href={`/admin/users/${m.b.id}`} className="hover:text-gold-2">{m.b.full_name}</Link>
                  </span>
                  <span className="shrink-0 text-[11px] text-mute-2">{when(m.matched_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="התראות וואטסאפ">
          {hooks.length === 0 ? (
            <p className="text-sm text-mute">עדיין לא נשלחו. הגדירו WHATSAPP_WEBHOOK_URL כדי להפעיל.</p>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {hooks.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-mute">
                    התאמה #{h.match_id} · {h.target}
                  </span>
                  {h.status_code && h.status_code < 400 ? <Badge tone="green">{h.status_code}</Badge> : <Badge tone="red">{h.status_code ?? "שגיאה"}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
