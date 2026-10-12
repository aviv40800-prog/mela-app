import { Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { SwipeDeck } from "@/components/SwipeDeck";
import { requirePageUser } from "@/lib/guard";

export default async function DiscoverPage() {
  const me = await requirePageUser("member");
  return (
    <main className="px-3 pt-[max(env(safe-area-inset-top),12px)]">
      <header className="flex h-14 items-center justify-between px-2">
        <Logo size="sm" />
        <span className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] text-mute">
          <Sparkles size={12} className="text-gold" /> לפי התאמה
        </span>
      </header>
      <SwipeDeck source="discover" me={{ name: me.full_name ?? "", photo: me.photos[0] }} />
    </main>
  );
}
