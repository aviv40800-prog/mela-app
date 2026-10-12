import { DiscoverView } from "@/components/DiscoverView";
import { requirePageUser } from "@/lib/guard";

export default async function DiscoverPage() {
  const me = await requirePageUser("member");
  return (
    <main className="px-3 pt-[max(env(safe-area-inset-top),12px)]">
      <DiscoverView
        me={{ name: me.full_name ?? "", photo: me.photos[0] }}
        prefs={{ seeking: me.seeking, pref_age_min: me.pref_age_min, pref_age_max: me.pref_age_max, pref_distance_km: me.pref_distance_km }}
      />
    </main>
  );
}
