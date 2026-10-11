const STEPS = ["אימות", "פרופיל", "מסלול"];

export function Stepper({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-2" aria-label={`שלב ${step} מתוך 3`}>
      {STEPS.map((label, i) => (
        <div key={label} className="flex-1">
          <div className={`h-1 rounded-full transition-all ${i < step ? "bg-gradient-to-l from-gold-2 to-gold" : "bg-white/10"}`} />
          <div className={`mt-1.5 text-[11px] ${i < step ? "text-gold-2" : "text-mute"}`}>{label}</div>
        </div>
      ))}
    </div>
  );
}
