import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { userDetail } from "@/lib/admin-data";
import { PLANS, promptQuestion } from "@/lib/content";
import { isAdmin } from "@/lib/admin";
import { Badge, Card, Stat, SUB_BADGE, subSource, UserChip, when } from "@/components/admin/ui";
import { AdminPhotos } from "@/components/admin/AdminPhotos";
import { AdminUserActions } from "@/components/admin/AdminUserActions";
import { SuggestMatchPanel } from "@/components/admin/SuggestMatchPanel";

const SEX: Record<string, string> = { male: "גבר", female: "אישה", everyone: "כולם" };

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const d = userDetail(Number((await params).id));
  if (!d) notFound();
  const { user: u, prompts, subscription: sub, stats, matches } = d;

  return (
    <>
      <Link href="/admin/users" className="mb-5 inline-flex items-center gap-1 text-sm text-mute hover:text-cream">
        <ArrowRight size={15} /> למשתמשים
      </Link>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold">{u.full_name ?? "פרופיל לא הושלם"}</h1>
        {u.is_verified && <BadgeCheck className="text-gold-2" />}
        {u.is_demo && <Badge>דמו</Badge>}
        {u.is_banned && <Badge tone="red">מושעה</Badge>}
        {isAdmin(u) && <Badge tone="gold">מנהל/ת</Badge>}
        {sub && <Badge tone={SUB_BADGE[sub.status].tone}>{[SUB_BADGE[sub.status].label, subSource(sub.provider_ref)].filter(Boolean).join(" · ")}</Badge>}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="תמונות">
            <AdminPhotos userId={u.id} initial={u.photos} name={u.full_name ?? ""} />
          </Card>

          <Card title="פרטים">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-3">
              {[
                ["טלפון", <span key="p" dir="ltr" className="tabular">{u.phone_number ?? "—"}</span>],
                ["אימייל", u.email ?? "—"],
                ["גיל", u.age ?? "—"],
                ["מגדר / מחפש/ת", `${u.gender ? SEX[u.gender] : "—"} → ${SEX[u.seeking]}`],
                ["עיר", u.location ?? "—"],
                ["עיסוק", u.occupation ?? "—"],
                ["הצטרף/ה", when(u.created_at)],
                ["נראה/תה לאחרונה", when(u.last_seen_at)],
                ["מזהה", `#${u.id}`],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <dt className="text-[12px] text-mute">{k}</dt>
                  <dd className="mt-0.5">{v}</dd>
                </div>
              ))}
            </dl>
            {u.bio && (
              <>
                <div className="hairline my-4" />
                <p className="text-sm leading-relaxed text-cream/85">{u.bio}</p>
              </>
            )}
          </Card>

          {!u.is_demo && (
            <Card title="💛 הצעת שידוך">
              <SuggestMatchPanel userId={u.id} name={u.full_name ?? ""} />
            </Card>
          )}

          <Card title={`שאלות מהבית (${prompts.length})`}>
            {prompts.length === 0 ? (
              <p className="text-sm text-mute">אין תשובות.</p>
            ) : (
              <ul className="space-y-3">
                {prompts.map((p) => (
                  <li key={p.question_key} className="rounded-2xl border border-line bg-fg/[0.02] p-4">
                    <div className="eyebrow">{promptQuestion(p.question_key)}</div>
                    <p className="mt-1.5 text-[15px]">{p.answer_text}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={`התאמות (${stats.matches})`}>
            {matches.length === 0 ? (
              <p className="text-sm text-mute">אין התאמות.</p>
            ) : (
              <ul className="space-y-3">
                {matches.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3">
                    <UserChip id={m.other.id} name={m.other.full_name} photo={m.other.photos[0]} sub={`${m.messages} הודעות`} />
                    <span className="shrink-0 text-[11px] text-mute-2">{when(m.matched_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="לייקים שנשלחו" value={stats.likesSent} />
            <Stat label="לייקים שהתקבלו" value={stats.likesReceived} accent />
            <Stat label="התאמות" value={stats.matches} />
            <Stat label="הודעות שנשלחו" value={stats.messagesSent} />
            <Stat label="הודעות שהתקבלו" value={stats.messagesReceived} />
            <Stat label="דילוגים" value={stats.passes} />
            <Stat
              label="פרופילים שעוד לא ראה/תה"
              value={stats.unseen.inRange}
              accent={stats.unseen.inRange === 0}
              sub={
                stats.unseen.inRange === 0
                  ? stats.unseen.all
                    ? `נגמרו בטווח שבחר/ה · ${stats.unseen.all} מחוץ לטווח`
                    : "נגמרו — הזמן לשידוך אישי"
                  : stats.unseen.all > stats.unseen.inRange
                    ? `+${stats.unseen.all - stats.unseen.inRange} מחוץ לטווח הגיל/מרחק`
                    : undefined
              }
            />
          </div>

          <Card title="מנוי">
            {sub ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-mute">מסלול</dt>
                  <dd>{PLANS[sub.plan_type].title}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-mute">סטטוס</dt>
                  <dd>{[SUB_BADGE[sub.status].label, subSource(sub.provider_ref)].filter(Boolean).join(" · ")}</dd>
                </div>
                {sub.trial_ends_at && (
                  <div className="flex justify-between">
                    <dt className="text-mute">סוף ניסיון</dt>
                    <dd>{when(sub.trial_ends_at)}</dd>
                  </div>
                )}
                {sub.payment_last4 && (
                  <div className="flex justify-between">
                    <dt className="text-mute">אמצעי תשלום</dt>
                    <dd className="tabular" dir="ltr">
                      {(sub.payment_brand ?? "card").toUpperCase()} •••• {sub.payment_last4}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-mute">סוף תקופה</dt>
                  <dd className="tabular">{sub.current_period_end.slice(0, 10)}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-mute">אין מנוי.</p>
            )}
          </Card>

          <AdminUserActions userId={u.id} verified={u.is_verified} banned={u.is_banned} hasSub={!!sub && sub.status !== "canceled"} seeking={u.seeking} />
        </div>
      </div>
    </>
  );
}
