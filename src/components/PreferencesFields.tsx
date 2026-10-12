"use client";

import { RangeSlider } from "./ui/RangeSlider";
import { Segmented } from "./ui/Segmented";

export type Prefs = { seeking: "male" | "female" | "everyone"; pref_age_min: number | null; pref_age_max: number | null; pref_distance_km: number | null };

const AGE_MIN = 18;
const AGE_MAX = 70; // the slider's top end means "and above"
const DIST_STEPS = [5, 10, 20, 30, 50, 75, 100, 150, 0]; // 0 = anywhere in Israel

/** Who I'm looking for: gender, age range and distance. Shared by onboarding, Discover and the profile. */
export function PreferencesFields({ value, onChange, hideSeeking }: { value: Prefs; onChange: (p: Prefs) => void; hideSeeking?: boolean }) {
  const lo = value.pref_age_min ?? AGE_MIN;
  const hi = value.pref_age_max ?? AGE_MAX;
  const distIdx = value.pref_distance_km === null ? DIST_STEPS.length - 1 : Math.max(0, DIST_STEPS.findIndex((d) => d >= value.pref_distance_km!));
  const distLabel = DIST_STEPS[distIdx] === 0 ? "בכל הארץ" : `עד ${DIST_STEPS[distIdx]} ק״מ`;

  return (
    <div className="space-y-6">
      {!hideSeeking && (
        <Segmented
          label="מחפש/ת"
          value={value.seeking}
          onChange={(v) => onChange({ ...value, seeking: v })}
          options={[
            ["female", "נשים"],
            ["male", "גברים"],
            ["everyone", "כולם"],
          ]}
        />
      )}
      <div>
        <div className="mb-2 flex items-baseline justify-between px-1">
          <span className="text-[13px] text-mute">טווח גילאים</span>
          <span className="tabular text-[15px] font-semibold text-gold-2" dir="ltr">
            {lo}–{hi >= AGE_MAX ? `${AGE_MAX}+` : hi}
          </span>
        </div>
        <RangeSlider
          min={AGE_MIN}
          max={AGE_MAX}
          value={[lo, hi]}
          labels={["גיל מינימלי", "גיל מקסימלי"]}
          onChange={(v) => {
            const [a, b] = v as [number, number];
            onChange({ ...value, pref_age_min: a <= AGE_MIN ? null : a, pref_age_max: b >= AGE_MAX ? null : b });
          }}
        />
      </div>
      <div>
        <div className="mb-2 flex items-baseline justify-between px-1">
          <span className="text-[13px] text-mute">מרחק מקסימלי</span>
          <span className="tabular text-[15px] font-semibold text-gold-2">{distLabel}</span>
        </div>
        <RangeSlider
          min={0}
          max={DIST_STEPS.length - 1}
          value={distIdx}
          labels="מרחק מקסימלי"
          onChange={(v) => {
            const d = DIST_STEPS[v as number];
            onChange({ ...value, pref_distance_km: d === 0 ? null : d });
          }}
        />
        <p className="mt-2 px-1 text-[11.5px] text-mute-2">המרחק מחושב בין ערים. מי שגר/ה במקום שלא מוכר לנו לא יוסתר/תוסתר.</p>
      </div>
    </div>
  );
}
