import Link from "next/link";
import { BadgeCheck, Pencil } from "lucide-react";
import { requirePageUser } from "@/lib/guard";
import { getSubscription } from "@/lib/billing";
import { toPublic } from "@/lib/users";
import { PLANS } from "@/lib/content";
import { Photo } from "@/components/Photo";
import { ProfileCard } from "@/components/ProfileCard";
import { AccountActions } from "@/components/AccountActions";

const STATUS: Record<string, string> = { trialing: "תקופת ניסיון", active: "פעיל", canceled: "בוטל", past_due: "תשלום נכשל" };

const fmtDate = (s: string) =>
  new Date(s.replace(" ", "T") + "Z").toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jerusalem" });

export default async function ProfilePage() {
  const user = await requirePageUser("member");
  const sub = getSubscription(user.id)!;
  const pub = toPublic(user);
  const plan = PLANS[sub.plan_type];

  return (
    <main className="px-4 pt-[max(env(safe-area-inset-top),24px)]">
      <div className="flex items-center gap-4">
        <div className="glow h-20 w-20 overflow-hidden rounded-full">
          <Photo src={user.photos[0]} name={user.full_name ?? ""} className="h-full w-full" rounded="rounded-full" />
        </div>
        <div className="flex-1">
          <h1 className="flex items-center gap-1.5 text-2xl font-bold">
            {user.full_name} {user.is_verified && <BadgeCheck size={20} className="text-gold" />}
          </h1>
          <p className="text-sm text-mute" dir="ltr" style={{ textAlign: "right" }}>
            {user.phone_number}
          </p>
        </div>
        <Link href="/onboarding/profile?edit=1" className="btn-ghost h-11 w-11 p-0" aria-label="עריכת פרופיל">
          <Pencil size={16} />
        </Link>
      </div>

      <section className="glass mt-6 rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-mute">המנוי שלי</div>
            <div className="mt-1 text-lg font-semibold">
              מסלול {plan.title} · <span dir="ltr">{plan.priceLabel}</span>
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              sub.status === "canceled" || sub.status === "past_due" ? "bg-danger/15 text-danger" : "bg-gold/15 text-gold-2"
            }`}
          >
            {STATUS[sub.status]}
          </span>
        </div>
        <p className="mt-3 text-sm text-mute">
          {sub.status === "trialing" && `הניסיון החינמי מסתיים ב־${fmtDate(sub.trial_ends_at!)}. החיוב הראשון יתבצע רק אז.`}
          {sub.status === "active" && `מתחדש ב־${fmtDate(sub.current_period_end)}.`}
          {sub.status === "canceled" && `הגישה נשמרת עד ${fmtDate(sub.current_period_end)}.`}
          {sub.status === "past_due" && "נא לעדכן אמצעי תשלום כדי להמשיך."}
        </p>
        <AccountActions canceled={sub.status === "canceled"} />
      </section>

      <h2 className="mt-8 mb-3 text-sm font-semibold text-mute">כך אחרים רואים אותך</h2>
      <ProfileCard c={{ ...pub, compatibility: 100, likedYou: false }} />
    </main>
  );
}
