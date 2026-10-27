import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DiscoverView } from "@/components/DiscoverView";
import { requirePageUser } from "@/lib/guard";
import { profileToShow } from "@/lib/suggestions";

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const showId = Number((await searchParams).show) || null;
  const me = await requirePageUser("member");
  // chose a Premium plan on the home page before signing up: checkout comes now that the profile is ready
  if ((await cookies()).get("mela_plan")) redirect("/premium");
  return (
    <main className="px-3 pt-[max(env(safe-area-inset-top),12px)]">
      <DiscoverView
        me={{ name: me.full_name ?? "", photo: me.photos[0] }}
        prefs={{ seeking: me.seeking, pref_age_min: me.pref_age_min, pref_age_max: me.pref_age_max, pref_distance_km: me.pref_distance_km }}
        show={showId ? profileToShow(me, showId) : null}
      />
    </main>
  );
}
