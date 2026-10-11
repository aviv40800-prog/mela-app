import Link from "next/link";
import { Heart } from "lucide-react";
import { requirePageUser } from "@/lib/guard";
import { likesReceived, listMatches } from "@/lib/matching";
import { Photo } from "@/components/Photo";
import { LiveRefresh } from "@/components/LiveRefresh";

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
  const likes = likesReceived(me.id);
  const fresh = matches.filter((m) => !m.lastMessage);
  const convos = matches.filter((m) => m.lastMessage);

  return (
    <main className="px-4 pt-[max(env(safe-area-inset-top),24px)]">
      <LiveRefresh />
      <h1 className="font-display text-3xl font-bold">התאמות</h1>

      {likes.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gold-2">
            <Heart size={14} className="fill-current" /> אהבו אותך ({likes.length})
          </h2>
          <div className="glass rounded-3xl p-4">
            <p className="text-sm text-mute">הם כבר מחכים לך בגילוי — לייק בחזרה ויש התאמה.</p>
            <div className="mt-3 flex -space-x-3 space-x-reverse">
              {likes.slice(0, 5).map((l) => (
                <div key={l.id} className="h-12 w-12 overflow-hidden rounded-full border-2 border-ink">
                  <Photo src={l.photos[0]} name={l.full_name} className="h-full w-full blur-[3px]" rounded="rounded-full" />
                </div>
              ))}
            </div>
            <Link href="/discover" className="btn-gold mt-4 w-full py-3 text-sm">
              לגלות מי
            </Link>
          </div>
        </section>
      )}

      {fresh.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-mute">התאמות חדשות</h2>
          <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4">
            {fresh.map((m) => (
              <Link key={m.matchId} href={`/matches/${m.matchId}`} className="w-20 shrink-0 text-center">
                <div className="glow h-20 w-20 overflow-hidden rounded-full p-[2px]">
                  <Photo src={m.other.photos[0]} name={m.other.full_name} className="h-full w-full" rounded="rounded-full" />
                </div>
                <div className="mt-2 truncate text-xs">{m.other.full_name.split(" ")[0]}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-semibold text-mute">שיחות</h2>
        {convos.length === 0 ? (
          <div className="glass rounded-3xl p-8 text-center text-sm text-mute">
            {matches.length ? "שלחו הודעה ראשונה להתאמות החדשות שלכם 💬" : "עוד אין התאמות. המשיכו לגלות — האהבה בדרך 💛"}
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {convos.map((m) => (
              <li key={m.matchId}>
                <Link href={`/matches/${m.matchId}`} className="flex items-center gap-3 py-3.5">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full">
                    <Photo src={m.other.photos[0]} name={m.other.full_name} className="h-full w-full" rounded="rounded-full" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold ${m.unread ? "text-cream" : "text-cream/90"}`}>{m.other.full_name.split(" ")[0]}</span>
                      <span className="text-[11px] text-mute">{timeLabel(m.lastMessage!.sentAt)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <span className={`truncate text-sm ${m.unread ? "font-medium text-cream" : "text-mute"}`}>
                        {m.lastMessage!.fromMe && "את/ה: "}
                        {m.lastMessage!.text.replace(/\n/g, " ")}
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
