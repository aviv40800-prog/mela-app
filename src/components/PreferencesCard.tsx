"use client";

import { Vibrate, Wind } from "lucide-react";
import { setPref, usePrefs } from "@/lib/prefs";
import { Toggle } from "./ui/Toggle";

export function PreferencesCard() {
  const prefs = usePrefs();
  const rows = [
    { key: "haptics" as const, Icon: Vibrate, title: "משוב רטט", subtitle: "רטט עדין בלייק, התאמה והודעה" },
    { key: "reduceMotion" as const, Icon: Wind, title: "הפחתת אנימציות", subtitle: "מעברים שקטים יותר" },
  ];
  return (
    <div className="surface overflow-hidden rounded-[24px]">
      {rows.map(({ key, Icon, title, subtitle }, i) => (
        <div key={key}>
          {i > 0 && <div className="hairline mr-[60px]" />}
          <div className="flex items-center gap-3.5 px-4 py-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/[0.07] text-gold-2">
              <Icon size={18} />
            </span>
            <div className="flex-1">
              <div className="text-[15px]">{title}</div>
              <div className="text-[12.5px] text-mute">{subtitle}</div>
            </div>
            <Toggle label={title} checked={prefs[key]} onChange={(v) => setPref(key, v)} />
          </div>
        </div>
      ))}
    </div>
  );
}
