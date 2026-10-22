import { PicksView } from "@/components/PicksView";
import { AdmirersGallery } from "@/components/AdmirersGallery";
import { ThisOrThat } from "@/components/ThisOrThat";
import { requirePageUser } from "@/lib/guard";

export default async function PicksPage() {
  const me = await requirePageUser("member");
  return (
    <main className="px-4 pt-[max(env(safe-area-inset-top),24px)]">
      <PicksView me={{ name: me.full_name ?? "", photo: me.photos[0] }} />
      <AdmirersGallery me={{ name: me.full_name ?? "", photo: me.photos[0] }} />
      <ThisOrThat />
    </main>
  );
}
