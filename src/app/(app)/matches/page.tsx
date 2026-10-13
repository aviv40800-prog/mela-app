import Link from "next/link";
import { Crown, Heart } from "lucide-react";
import { isPremium } from "@/lib/quota";
import { LikesYou } from "@/components/LikesYou";
import { requirePageUser } from "@/lib/guard";
import { likesReceived, listMatches } from "@/lib/matching";
import { Photo } from "@/components/Photo";
import { LiveRefresh } from "@/components/LiveRefresh";
import { DATE_PREFIX } from "@/lib/content";

export const dynamic = "force-dynamic";

function timeLabel(iso: string) {
  const d = new Date(iso.endsWith("Z") ? iso : iso.replace(" ", "T") + "Z");
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" })
    : d.toLocaleDateString("he-IL", { day: "numeric", month: "short", timeZone: "Asia/Jerusalem" });
}

export default async function MatchesPage() {
  const me = await requirePageUser("member");
  const matches = listMatches(me.id);
  const premium = isPremium(me.id);
  // Free members only learn how many people liked them; identities are a Premium feature.
  const likes = likesReceived(me.id);
  const fresh = matches.filter((m) => !m.lastMessage);
  const convos = matches.filter((m) => m.lastMessage);

  return (
    <main className="px-4 pt-[max(env(safe-area-inset-top),24px)]">
      <LiveRefresh />
      <p className="eyebrow">האנשים שלך</p>
      <h1 className="font-display mt-1 text-[2rem] leading-tight font-bold">התאמות</h1>

      {likes.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gold-2">
            <Heart size={14} className="fill-current" /> אהבו אותך ({likes.length})
          </h2>
          {premium ? (
            <LikesYou likes={likes.map((l) => ({ id: l.id, name: l.full_name, age: l.age, location: l.location, photo: l.photos[0] ?? null, comment: l.comment }))} />
          ) : (
            <div className="animate-rise relative isolate overflow-hidden rounded-[26px] border border-gold/25 p-5 shadow-[var(--shadow-float)]">
              <div className="absolute inset-0 -z-10 bg-[radial-gradient(100%_100%_at_100%_0%,rgba(180,87,58,0.18),transparent_60%),linear-gradient(180deg,var(--color-ink-3),var(--color-ink-2))]" />
              <p className="text-[14.5px] text-cream/85">
                {likes.length === 1 ? "מישהו/י כבר אהב/ה אותך." : `${likes.length} אנשים כבר אהבו אותך.`} עם Premium רואים מי — ומחזירים לייק בלחיצה.
              </p>
              <div className="mt-4 flex -space-x-3 space-x-reverse">
                {likes.slice(0, 5).map((l) => (
                  <div key={l.id} className="h-12 w-12 overflow-hidden rounded-full ring-2 ring-ink-3">
                    <Photo src={undefined} name="♥" className="h-full w-full scale-110 blur-[2px]" rounded="rounded-full" />
                  </div>
                ))}
              </div>
              <Link href="/onboarding/plan" className="btn-gold mt-4 w-full py-3 text-sm">
                <Crown size={15} /> לראות מי אהב/ה אותי
              </Link>
            </div>
          )}
        </section>
      )}

      {fresh.length > 0 && (
        <section className="mt-8">
          <h2 className="eyebrow mb-3">התאמות חדשות</h2>
          <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-1">
            {fresh.map((m, i) => (
              <Link key={m.matchId} href={`/matches/${m.matchId}`} className="animate-rise w-[76px] shrink-0 text-center" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="rounded-full bg-gradient-to-b from-gold-3 to-gold-dim p-[2px] shadow-[0_0_22px_-6px_rgba(180,87,58,0.7)] transition-transform duration-300 hover:scale-105">
                  <div className="h-[72px] w-[72px] overflow-hidden rounded-full ring-2 ring-ink">
                    <Photo src={m.other.photos[0]} name={m.other.full_name} className="h-full w-full" rounded="rounded-full" />
                  </div>
                </div>
                <div className="mt-2 truncate text-xs">{m.other.full_name.split(" ")[0]}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="eyebrow mb-2">שיחות</h2>
        {convos.length === 0 ? (
          <div className="surface rounded-[26px] p-8 text-center text-sm text-mute">
            {matches.length ? "ההתאמות החדשות שלכם מחכות להודעה ראשונה." : "עוד אין התאמות. כל לייק מקרב — המשיכו לגלות."}
          </div>
        ) : (
          <ul className="surface overflow-hidden rounded-[24px]">
            {convos.map((m, i) => (
              <li key={m.matchId} className="animate-rise" style={{ animationDelay: `${i * 50}ms` }}>
                {i > 0 && <div className="hairline mr-[76px]" />}
                <Link href={`/matches/${m.matchId}`} className="press flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-fg/[0.03] active:bg-fg/[0.05]">
                  <div className={`h-14 w-14 shrink-0 overflow-hidden rounded-full ${m.unread ? "ring-2 ring-gold/70 ring-offset-2 ring-offset-ink-3" : ""}`}>
                    <Photo src={m.other.photos[0]} name={m.other.full_name} className="h-full w-full" rounded="rounded-full" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold ${m.unread ? "text-cream" : "text-cream/90"}`}>{m.other.full_name.split(" ")[0]}</span>
                      <span className={`tabular text-[11px] ${m.unread ? "font-semibold text-gold-2" : "text-mute-2"}`}>{timeLabel(m.lastMessage!.sentAt)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <span className={`truncate text-sm ${m.unread ? "font-medium text-cream" : "text-mute"}`}>
                        {m.lastMessage!.fromMe && "את/ה: "}
                        {m.lastMessage!.text.startsWith(DATE_PREFIX)
                          ? `הצעה לדייט · ${m.lastMessage!.text.split("\n")[1] ?? ""}`
                          : m.lastMessage!.text.replace(/\n/g, " ")}
                      </span>
                      {m.unread > 0 && (
                        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1.5 text-[11px] font-bold text-ink">{m.unread}</span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
