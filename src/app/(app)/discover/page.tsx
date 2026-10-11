import { SlidersHorizontal } from "lucide-react";
import { Logo } from "@/components/Logo";
import { SwipeDeck } from "@/components/SwipeDeck";

export default function DiscoverPage() {
  return (
    <main className="px-3 pt-[max(env(safe-area-inset-top),12px)]">
      <header className="flex h-14 items-center justify-between px-2">
        <Logo size="sm" />
        <span className="flex items-center gap-1.5 text-xs text-mute">
          <SlidersHorizontal size={14} /> לפי התאמה
        </span>
      </header>
      <SwipeDeck source="discover" />
    </main>
  );
}
