import { BadgeCheck, Heart, MapPin, X } from "lucide-react";
import { CompatRing } from "../ui/CompatRing";

/** Illustrative phone frame with a sample (fictional) profile card. */
export function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[270px]">
      <div className="absolute -inset-10 rounded-full bg-gold/15 blur-3xl" />
      <div className="relative rounded-[46px] border border-fg/10 bg-gradient-to-b from-[#1d1d21] to-[#0c0c0e] p-2.5 shadow-[0_40px_80px_-30px_rgba(90,52,26,0.3),inset_0_1px_0_rgba(70,42,24,0.08)]">
        <div className="absolute top-4 left-1/2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
        <div className="on-dark relative h-[540px] overflow-hidden rounded-[38px] bg-[#3b2416]">
          <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_30%_10%,#7a4a2c,#2e1a0f_70%)]" />
          <svg className="absolute inset-0 h-full w-full opacity-[0.09]" aria-hidden>
            <defs>
              <pattern id="pm-weave" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <path d="M0 14h28M14 0v28" stroke="#b4573a" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#pm-weave)" />
          </svg>
          <div className="font-display emboss absolute inset-x-0 top-28 text-center text-[9rem] leading-none font-bold opacity-80">ב</div>
          <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black via-black/70 to-transparent" />
          <div className="absolute top-12 right-4 flex items-center gap-1 rounded-full border border-gold/30 bg-black/40 px-2.5 py-1 text-[10px] font-semibold text-gold-2 backdrop-blur">
            <CompatRing value={92} size={11} /> 92% התאמה
          </div>
          <div className="absolute inset-x-0 bottom-24 px-5">
            <div className="flex items-baseline gap-2 text-[1.7rem] leading-none font-bold">
              בתאל <span className="text-[1.3rem] font-light text-cream/85">25</span>
              <BadgeCheck size={18} className="self-center text-gold-2" />
            </div>
            <div className="mt-2.5 flex gap-1.5 text-[11px]">
              <span className="rounded-full bg-fg/10 px-2.5 py-1">סטודנטית לאחיות</span>
              <span className="flex items-center gap-1 rounded-full bg-fg/10 px-2.5 py-1">
                <MapPin size={10} /> חיפה
              </span>
            </div>
            <div className="mt-3 rounded-2xl border border-fg/10 bg-black/30 p-3 backdrop-blur">
              <div className="text-[9.5px] font-semibold text-gold-2">טקס הבונה המושלם בשבילי כולל...</div>
              <div className="font-display mt-1 text-[13px] leading-snug">ג׳בנה של סבתא, קטורת ושקט של בוקר שבת.</div>
            </div>
          </div>
          {/* same layout as the app: ✕ (pass) on the left, red ♥ (like) on the right */}
          <div dir="ltr" className="absolute inset-x-0 bottom-6 flex justify-center gap-5">
            <span className="grid h-12 w-12 place-items-center rounded-full border border-white/25 bg-white/10 backdrop-blur">
              <X size={20} />
            </span>
            <span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-b from-[#ff6b70] via-[#e5383b] to-[#b8141c] text-white shadow-[0_10px_30px_-6px_rgba(229,56,59,0.8)]">
              <Heart size={24} className="fill-current" />
            </span>
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-[11px] text-mute-2">המחשה · פרופיל לדוגמה</p>
    </div>
  );
}
