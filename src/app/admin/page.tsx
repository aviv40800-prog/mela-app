import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { overview, recentMatches, recentSignups, recentWebhooks, signupsByDay } from "@/lib/admin-data";
import { SignupsChart } from "@/components/admin/SignupsChart";
import { aiUsageStats } from "@/lib/ai-onboarding";
import { departures } from "@/lib/departures";
import { DEPARTURE_REASONS } from "@/lib/content";
import { featuredResults } from "@/lib/checkin";
import { pendingCount } from "@/lib/auto-suggest";
import { emailsToday } from "@/lib/email-budget";
import { premiumTabStats } from "@/lib/plan-views";
import { STAGE_LABEL, signupFunnel, type Stage } from "@/lib/signup-stage";
import { TestSignupButton } from "@/components/admin/TestSignupButton";
import { Badge, Card, PageHeader, Stat, SUB_BADGE, UserChip, when } from "@/components/admin/ui";

const ils = (n: number) => `₪${n.toLocaleString("he-IL")}`;

export default function AdminOverview() {
  const o = overview();
  const series = signupsByDay(14);
  const signups = recentSignups(8);
  const matches = recentMatches(6);
  const hooks = recentWebhooks(6);
  const ai = aiUsageStats();
  const left = departures(8);
  const funnel = signupFunnel();
  const fq = featuredResults();
  const waiting = pendingCount();
  const mails = emailsToday();
  const tab = premiumTabStats();
  const KIND: Record<string, string> = { code: "קודי כניסה", message: "הודעות", reminder: "תזכורות", suggestion: "הצעות", alert: "מצטרפים חדשים", team: "לצוות", other: "אחר" };
  const usd = (n: number) => `$${n < 1 ? n.toFixed(3) : n.toFixed(2)}`;

  return (
    <>
      <PageHeader eyebrow="לוח בקרה" title="סקירה כללית">
        <TestSignupButton />
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

      {waiting > 0 && (
        <Link href="/admin/suggestions" className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-gold/35 bg-gold/[0.07] px-4 py-3 text-sm font-semibold text-gold-2">
          💛 {waiting} הצעות שידוך של ה־AI מחכות לאישור שלך <ArrowLeft size={15} />
        </Link>
      )}

      <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${mails.total >= mails.cap * 0.7 ? "border-danger/35 bg-danger/[0.06]" : "border-line-2"}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span>
            📧 מיילים היום: <b className="tabular">{mails.total}</b> מתוך <span className="tabular">{mails.cap}</span>
          </span>
          <span className="text-[12px] text-mute">
            {Object.entries(mails.byKind)
              .map(([k, n]) => `${KIND[k] ?? k} ${n}`)
              .join(" · ") || "עוד לא נשלחו"}
          </span>
        </div>
        {mails.total >= mails.cap * 0.7 && (
          <p className="mt-1.5 text-[12.5px] text-danger">מתקרבים לתקרה היומית: התראות על הודעות ותזכורות נעצרות ב־{Math.floor((mails.cap * 220) / 300)}, קודי כניסה תמיד יוצאים. אם זה קורה הרבה, כדאי לשדרג את Brevo.</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 rounded-2xl border border-line-2 px-4 py-3 text-sm">
        <span>
          👑 לשונית Premium: <b className="tabular">{tab.opened7d}</b> נכנסו לחבילות השבוע, <b className="tabular">{tab.paid7d}</b> מהם שילמו
        </span>
        <span className="text-[12px] text-mute tabular">
          מההתחלה: {tab.openedTotal} נכנסו · {tab.paidTotal} שילמו
        </span>
      </div>

      {o.webhookFailures7d > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-danger/30 bg-danger/[0.06] px-4 py-3 text-sm text-danger">
          <AlertTriangle size={16} /> {o.webhookFailures7d} שליחות וואטסאפ נכשלו השבוע — בדקו את הגדרות ה־webhook.
        </div>
      )}

      {fq && (
        <Card title={`שאלת השבוע · ${"title" in fq.q ? fq.q.title : `${fq.q.a} או ${fq.q.b}`}`} className="mt-4">
          {fq.a + fq.b === 0 ? (
            <p className="text-sm text-mute">עוד אף אחד לא ענה.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {(["a", "b"] as const).map((k) => {
                const pct = Math.round((fq[k] / (fq.a + fq.b)) * 100);
                return (
                  <div key={k} className="text-sm">
                    <div className="mb-1 flex justify-between">
                      <span className="font-semibold">{fq.q[k]}</span>
                      <span className="tabular text-mute">
                        {pct}% · {fq[k]}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-fg/[0.06]">
                      <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <p className="text-[12px] text-mute-2">{fq.a + fq.b} ענו (משתמשים אמיתיים בלבד)</p>
            </div>
          )}
        </Card>
      )}

      <Card title="הרשמה בשיחה עם AI" className="mt-4">
        {ai.enabled ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
            <div>
              <div className="text-mute">שיחות היום</div>
              <div className="tabular mt-0.5 text-lg font-semibold">
                {ai.today.users}
                {ai.limit ? <span className="text-sm font-normal text-mute"> / {ai.limit}</span> : null}
              </div>
            </div>
            <div>
              <div className="text-mute">עלות היום</div>
              <div className="tabular mt-0.5 text-lg font-semibold">{usd(ai.today.cost)}</div>
            </div>
            <div>
              <div className="text-mute">עלות ב־30 יום</div>
              <div className="tabular mt-0.5 text-lg font-semibold">{usd(ai.month.cost)}</div>
              <div className="text-[12px] text-mute-2">{ai.month.users} שיחות</div>
            </div>
            <div>
              <div className="text-mute">ממוצע להרשמה שהושלמה</div>
              <div className="tabular mt-0.5 text-lg font-semibold">{ai.finished.n ? usd(ai.finished.avg) : "—"}</div>
              <div className="text-[12px] text-mute-2">{ai.finished.n} הושלמו</div>
            </div>
            <p className="col-span-full text-[12px] text-mute-2" dir="ltr" style={{ textAlign: "right" }}>
              {ai.model}
            </p>
          </div>
        ) : (
          <p className="text-sm text-mute">כבוי — משתמשים חדשים נרשמים בטופס. כדי להפעיל: להגדיר ANTHROPIC_API_KEY ב־Railway.</p>
        )}
      </Card>

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

      <Card title="משפך הרשמה" className="mt-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(
            [
              ["נרשמו (קוד)", funnel.reached.signedUp],
              ["התחילו פרופיל", funnel.reached.started],
              ["עברו את כרטיס הפרטים", funnel.reached.details],
              ["אישרו ביו", funnel.reached.bio],
              ["השלימו פרופיל", funnel.reached.complete],
            ] as const
          ).map(([label, n], i) => (
            <div key={label} className="rounded-2xl border border-line bg-fg/[0.03] px-3 py-2.5">
              <div className="text-[12px] text-mute">{label}</div>
              <div className="tabular mt-0.5 text-lg font-semibold">
                {n}
                {i > 0 && funnel.reached.signedUp > 0 && <span className="text-[12px] font-normal text-mute"> · {Math.round((n / funnel.reached.signedUp) * 100)}%</span>}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 mb-2 text-[12.5px] font-semibold">איפה עומדים עכשיו מי שלא השלימו:</p>
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(funnel.now) as [Stage, number][])
            .filter(([s, n]) => s !== "complete" && n > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([s, n]) => (
              <Link key={s} href="/admin/users?filter=incomplete" className="rounded-full bg-fg/[0.05] px-2.5 py-1 text-[12px] hover:text-gold-2">
                {STAGE_LABEL[s]} · <b className="tabular">{n}</b>
              </Link>
            ))}
        </div>
      </Card>

      <Card title="משתמשים שעזבו (מחקו את החשבון)" className="mt-4">
        <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>השבוע: <b className="tabular">{left.week}</b></span>
          <span>30 יום: <b className="tabular">{left.month}</b></span>
          <span className="text-mute">סה״כ: <span className="tabular">{left.total}</span></span>
        </div>
        {left.reasons.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2 text-[12.5px]">
            {left.reasons.map((r) => (
              <span key={r.reason} className="rounded-full border border-line-2 px-3 py-1">
                {DEPARTURE_REASONS[r.reason]} · <b className="tabular">{r.n}</b>
              </span>
            ))}
          </div>
        )}
        {left.recent.length === 0 ? (
          <p className="text-sm text-mute">עוד אף אחד לא מחק חשבון.</p>
        ) : (
          <ul className="space-y-2.5 text-sm">
            {left.recent.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span>
                  {d.gender === "female" ? "אישה" : d.gender === "male" ? "גבר" : "—"}
                  {d.age ? `, ${d.age}` : ""}
                  <span className="text-mute"> · היה/תה {stayed(d.signed_up_at, d.left_at)}</span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-mute">
                  {!d.profile_complete && <Badge tone="red">פרופיל לא הושלם</Badge>}
                  {d.premium ? <Badge tone="gold">Premium</Badge> : null}
                  <span>{d.likes} לייקים · {d.passes} דילוגים · {d.matches} התאמות · {d.messages} הודעות</span>
                  <span className="text-mute-2">· {when(d.left_at)}</span>
                </span>
                {d.reason && (
                  <span className="basis-full text-[12.5px] text-gold-2">
                    למה: {DEPARTURE_REASONS[d.reason]}
                    {d.reason_text && <span className="text-mute"> · ״{d.reason_text}״</span>}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11.5px] text-mute-2">נשמרים רק נתונים אנונימיים: בלי שם, פרטי קשר או עיר.</p>
      </Card>
    </>
  );
}

/** How long a member stayed, from sign-up to deleting the account. */
function stayed(from: string | null, to: string) {
  if (!from) return "—";
  const ms = (s: string) => new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z").getTime();
  const mins = Math.max(0, Math.round((ms(to) - ms(from)) / 60000));
  if (mins < 60) return `${mins} דק׳`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} שע׳`;
  return `${Math.round(mins / 1440)} ימים`;
}
