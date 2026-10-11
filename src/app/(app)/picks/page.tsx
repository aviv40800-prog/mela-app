import { PicksView } from "@/components/PicksView";
import { ThisOrThat } from "@/components/ThisOrThat";

export default function PicksPage() {
  return (
    <main className="px-4 pt-[max(env(safe-area-inset-top),24px)]">
      <PicksView />
      <ThisOrThat />
    </main>
  );
}
