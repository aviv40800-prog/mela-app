import Link from "next/link";
import { BadgeCheck, Crown, Camera, ChevronLeft, Feather, LayoutDashboard, MapPin, MessageSquareQuote, Phone, Scale, UserRound } from "lucide-react";
import { requirePageUser } from "@/lib/guard";
import { isAdmin } from "@/lib/admin";
import { getSubscription, hasAccess } from "@/lib/billing";
import { getQuota } from "@/lib/quota";
import { toPublic } from "@/lib/users";
import { LOOKING_FOR, MARITAL_STATUS, PARTNER_RELIGIOSITY, PLANS, RELIGIOSITY, promptQuestion } from "@/lib/content";
import { Photo } from "@/components/Photo";
import { MembershipActions, LogoutRow } from "@/components/AccountActions";
import { PreferencesCard } from "@/components/PreferencesCard";
import { SearchPrefsRow } from "@/components/SearchPrefsRow";
import { ImproveProfile } from "@/components/ImproveProfile";
import { ProfilePreviewButton } from "@/components/ProfilePreviewButton";

const STATUS: Record<string, { label: string; tone: string }> = {
  trialing: { label: "תקופת ניסיון", tone: "bg-gold/15 text-gold-2" },
  active: { label: "פעיל", tone: "bg-success/15 text-success" },
  canceled: { label: "בוטל", tone: "bg-danger/15 text-danger" },
  past_due: { label: "תשלום נכשל", tone: "bg-danger/15 text-danger" },
};

const fmtDate = (s: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }) =>
  new Date(s.replace(" ", "T") + (s.endsWith("Z") ? "" : "Z")).toLocaleDateString("he-IL", { ...opts, timeZone: "Asia/Jerusalem" });

export default async function ProfilePage() {
  const user = await requirePageUser("member");
  const sub = getSubscription(user.id);
  const premium = hasAccess(sub);
  const quota = getQuota(user.id);
  const pub = toPublic(user);
  const plan = sub ? PLANS[sub.plan_type] : null;
  const status = sub ? STATUS[sub.status] : null;

  // Profile strength — weights reflect what drives matches.
  const parts = [
    { ok: Math.min(user.photos.length, 4) / 4, w: 40, tip: `הוסיפו עוד ${4 - user.photos.length} תמונות` },
    { ok: pub.prompts.length / 3, w: 25, tip: "ענו על שאלה שלישית" },
    { ok: Math.min((user.bio ?? "").length, 80) / 80, w: 15, tip: "הרחיבו קצת את ה״עליי״" },
    { ok: user.email ? 1 : 0, w: 10, tip: "הוסיפו אימייל" },
    { ok: user.is_verified ? 1 : 0, w: 10, tip: "" },
  ];
  const strength = Math.round(parts.reduce((s, p) => s + p.ok * p.w, 0));
  const tip = parts.find((p) => p.ok < 1 && p.tip)?.tip;
  const first = (user.full_name ?? "").split(" ")[0];
  const edit = (step: string) => `/onboarding/profile?edit=1&step=${step}`;

  return (
    <main className="px-4 pt-[max(env(safe-area-inset-top),20px)]">
      {/* hero */}
      <section className="flex flex-col items-center pt-4 text-center">
        <StrengthRing value={strength}>
          <div className="h-[104px] w-[104px] overflow-hidden rounded-full">
            <Photo src={user.photos[0]} name={user.full_name ?? ""} className="h-full w-full" rounded="rounded-full" />
          </div>
        </StrengthRing>
        <h1 className="mt-4 flex items-center gap-1.5 text-[1.65rem] font-bold">
          {user.full_name}
          {user.is_verified && <BadgeCheck size={22} className="fill-gold/15 text-gold-2" aria-label="מאומת/ת" />}
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-mute">
          <MapPin size={13} /> {user.location} · חבר/ה מאז {fmtDate(user.created_at, { month: "long", year: "numeric" })}
        </p>
        <div className="mt-4 rounded-full border border-gold/25 bg-gold/[0.06] px-3.5 py-1.5 text-[12px] text-gold-2">
          חוזק הפרופיל <b className="tabular">{strength}%</b>
          {tip && <span className="text-mute"> · {tip}</span>}
        </div>
        <div className="mt-5 grid w-full grid-cols-2 gap-3">
          <ProfilePreviewButton profile={{ ...pub, compatibility: 100, likedYou: false }} />
          <Link href={edit("photos")} className="btn-gold py-3 text-sm">
            עריכת פרופיל
          </Link>
        </div>
      </section>

      <section className="mt-9">
        <SectionTitle>שיפור ההתאמות</SectionTitle>
        <ImproveProfile />
      </section>

      {/* membership card */}
      <section className="mt-9">
        <SectionTitle>המנוי שלי</SectionTitle>
        {premium && sub && plan && status ? (
          <>
        <div className="relative overflow-hidden rounded-[26px] border border-gold/30 p-5 shadow-[0_30px_60px_-30px_rgba(212,175,55,0.45),var(--shadow-float)]">
          <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_100%_0%,rgba(229,193,88,0.28),transparent_55%),radial-gradient(90%_80%_at_0%_100%,rgba(138,113,36,0.35),transparent_60%),linear-gradient(135deg,#1d1a12,#0f0e0b)]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-gold-3/70 to-transparent" />
          <div className="tilet absolute inset-x-6 bottom-3 opacity-40" />
          <div className="relative">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-display gold-text text-xl font-bold tracking-[0.3em]" dir="ltr">
                  MELA
                </div>
                <div className="mt-0.5 text-[10px] tracking-[0.25em] text-gold/70" dir="ltr">
                  PRIVATE MEMBER
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${status.tone}`}>{status.label}</span>
            </div>
            <div className="mt-8 flex items-end justify-between">
              <div>
                <div className="text-[11px] text-mute">מסלול</div>
                <div className="mt-0.5 text-lg font-semibold">{plan.title}</div>
              </div>
              <div className="text-left">
                <div className="font-display text-[1.7rem] leading-none font-bold" dir="ltr">
                  {plan.priceLabel}
                </div>
                <div className="mt-1 text-[11px] text-mute">{plan.period}</div>
              </div>
            </div>
            <p className="mt-5 mb-3 text-[12.5px] text-cream/75">
              {sub.status === "trialing" && `הניסיון החינמי מסתיים ב־${fmtDate(sub.trial_ends_at!)}. החיוב הראשון רק אז.`}
              {sub.status === "active" && `מתחדש ב־${fmtDate(sub.current_period_end)}.`}
              {sub.status === "canceled" && `הגישה נשמרת עד ${fmtDate(sub.current_period_end)}.`}
              {sub.status === "past_due" && "נא לעדכן אמצעי תשלום כדי להמשיך."}
            </p>
            {sub.payment_last4 && (
              <p className="tabular mb-3 text-[12px] text-cream/60" dir="ltr" style={{ textAlign: "right" }}>
                {(sub.payment_brand ?? "card").toUpperCase()} •••• {sub.payment_last4} · {sub.payment_exp}
              </p>
            )}
          </div>
        </div>
            <MembershipActions canceled={sub.status === "canceled"} />
          </>
        ) : (
          <div className="surface relative overflow-hidden rounded-[26px] p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-display text-xl font-bold tracking-[0.3em] text-cream/90" dir="ltr">
                  MELA
                </div>
                <div className="mt-0.5 text-[10px] tracking-[0.25em] text-mute" dir="ltr">
                  FREE MEMBER
                </div>
              </div>
              <span className="rounded-full bg-white/[0.07] px-3 py-1 text-[11px] font-semibold text-mute">חינם</span>
            </div>
            <div className="mt-6">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-mute">לייקים היום</span>
                <span className="tabular font-semibold">
                  {quota.used} / {quota.limit}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="mr-0 ml-auto h-full rounded-full bg-gradient-to-l from-gold-3 to-gold"
                  style={{ width: `${Math.min(100, (quota.used / (quota.limit ?? 1)) * 100)}%` }}
                />
              </div>
              <p className="mt-3 text-[12.5px] text-mute">מתאפס כל לילה בחצות. עם Premium — ללא הגבלה, כל 3 הבחירות היומיות, ולראות מי אהב/ה אותך.</p>
            </div>
            <Link href="/onboarding/plan" className="btn-gold mt-5 w-full py-3 text-sm">
              <Crown size={15} /> {sub ? "חידוש Premium" : "שדרוג ל־Premium · 7 ימים חינם"}
            </Link>
          </div>
        )}
      </section>

      {/* profile sections */}
      <section className="mt-9">
        <SectionTitle>הפרופיל שלי</SectionTitle>
        <div className="surface overflow-hidden rounded-[24px]">
          <Row href={edit("photos")} icon={<Camera size={18} />} title="תמונות" subtitle={`${user.photos.length} מתוך 6`}>
            <div className="flex -space-x-2 space-x-reverse">
              {user.photos.slice(0, 3).map((p) => (
                <div key={p} className="h-8 w-8 overflow-hidden rounded-full ring-2 ring-ink-3">
                  <Photo src={p} name="" className="h-full w-full" rounded="rounded-full" />
                </div>
              ))}
            </div>
          </Row>
          <Divider />
          <Row href={edit("basics")} icon={<UserRound size={18} />} title="פרטים בסיסיים" subtitle={`${user.age} · ${user.location} · ${user.occupation}`} />
          <Divider />
          <Row href={edit("about")} icon={<Feather size={18} />} title="עליי" subtitle={user.bio ?? ""} />
          <Divider />
          <Row
            href={edit("prompts")}
            icon={<MessageSquareQuote size={18} />}
            title={`שאלות מהבית (${pub.prompts.length}/3)`}
            subtitle={pub.prompts.map((p) => promptQuestion(p.question_key).replace("...", "")).join(" · ")}
          />
          <Divider />
          <Row
            href={edit("quiz")}
            icon={<Scale size={18} />}
            title="סטטוס, כוונות ומסורת"
            subtitle={
              user.religiosity || user.marital_status
                ? [
                    user.marital_status && MARITAL_STATUS[user.marital_status],
                    user.looking_for && LOOKING_FOR[user.looking_for],
                    user.religiosity && `${RELIGIOSITY[user.religiosity]} (בצד השני: ${PARTNER_RELIGIOSITY[user.partner_religiosity ?? "any"]})`,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "עוד לא ענית — זה עוזר לנו להתאים"
            }
          />
        </div>
      </section>

      <section className="mt-9">
        <SectionTitle>העדפות</SectionTitle>
        <div className="space-y-3">
          <SearchPrefsRow prefs={{ seeking: user.seeking, pref_age_min: user.pref_age_min, pref_age_max: user.pref_age_max, pref_distance_km: user.pref_distance_km }} />
          <PreferencesCard />
        </div>
      </section>

      <section className="mt-9">
        <SectionTitle>חשבון</SectionTitle>
        <div className="surface overflow-hidden rounded-[24px]">
          <div className="flex items-center gap-3.5 px-4 py-4">
            <IconBox>
              <Phone size={18} />
            </IconBox>
            <div className="flex-1">
              <div className="text-[15px]">טלפון מאומת</div>
              <div className="tabular text-[12.5px] text-mute" dir="ltr" style={{ textAlign: "right" }}>
                {user.phone_number}
              </div>
            </div>
            <BadgeCheck size={18} className="text-gold-2" />
          </div>
          {isAdmin(user) && (
            <>
              <Divider />
              <Row href="/admin" icon={<LayoutDashboard size={18} />} title="לוח ניהול" subtitle="משתמשים, מנויים והתאמות" />
            </>
          )}
          <Divider />
          <LogoutRow />
        </div>
      </section>

      <footer className="mt-10 mb-4 text-center text-[11px] text-mute-2">
        <div className="gold-hairline mx-auto mb-4 w-24" />
        MELA · אהבה עם שורשים · {first ? `נעים שאת/ה כאן, ${first}` : ""}
      </footer>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="eyebrow mb-3 px-1">{children}</h2>;
}

function Divider() {
  return <div className="hairline mr-[60px]" />;
}

function IconBox({ children }: { children: React.ReactNode }) {
  return <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/[0.07] text-gold-2">{children}</span>;
}

function Row({ href, icon, title, subtitle, children }: { href: string; icon: React.ReactNode; title: string; subtitle: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className="group flex items-center gap-3.5 px-4 py-4 transition-colors hover:bg-white/[0.03] active:bg-white/[0.05]">
      <IconBox>{icon}</IconBox>
      <div className="min-w-0 flex-1">
        <div className="text-[15px]">{title}</div>
        <div className="truncate text-[12.5px] text-mute">{subtitle}</div>
      </div>
      {children}
      <ChevronLeft size={18} className="shrink-0 text-mute-2 transition-transform duration-300 group-hover:-translate-x-1" />
    </Link>
  );
}

/** Gold progress ring around the avatar. */
function StrengthRing({ value, children }: { value: number; children: React.ReactNode }) {
  const r = 60;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-[132px] w-[132px] place-items-center">
      <svg viewBox="0 0 132 132" className="absolute inset-0 -rotate-90 drop-shadow-[0_0_10px_rgba(212,175,55,0.45)]" aria-hidden>
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f3dc94" />
            <stop offset="1" stopColor="#b8922a" />
          </linearGradient>
        </defs>
        <circle cx="66" cy="66" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
        <circle cx="66" cy="66" r={r} fill="none" stroke="url(#ring)" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
      </svg>
      {children}
    </div>
  );
}
