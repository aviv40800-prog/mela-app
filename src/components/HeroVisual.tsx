import { HERO_PHOTOS } from "@/lib/demo-photos";

/**
 * Landing hero. Shows the photography in HERO_PHOTOS (src/lib/demo-photos.ts) when provided;
 * otherwise an abstract composition of two overlapping "profile" cards with a gold heart.
 */
export function HeroVisual() {
  const [a, b] = HERO_PHOTOS;
  return (
    <div className="animate-rise relative mx-auto mt-8 mb-6 h-[340px] w-full max-w-[340px]">
      <div className="absolute inset-0 rounded-full bg-gold/10 blur-3xl" />
      <Card src={a} className="absolute top-2 right-2 h-[270px] w-[190px] rotate-[7deg]" label="ת" />
      <Card src={b} className="absolute bottom-2 left-2 h-[270px] w-[190px] -rotate-[6deg]" label="י" />
      <div className="animate-pulse-ring absolute top-1/2 left-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gradient-to-b from-gold-2 to-gold text-2xl text-ink shadow-xl">
        ♥
      </div>
    </div>
  );
}

function Card({ src, className, label }: { src?: string; className: string; label: string }) {
  return (
    <div className={`glow overflow-hidden rounded-[28px] border border-gold/30 bg-ink-3 ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="relative h-full w-full bg-[radial-gradient(120%_80%_at_30%_10%,#3a2a12,#121214_70%)]">
          <div className="absolute inset-x-0 top-6 text-center font-display text-7xl font-bold text-gold/25">{label}</div>
          <div className="absolute inset-x-4 bottom-4 space-y-2">
            <div className="h-2.5 w-2/3 rounded-full bg-cream/20" />
            <div className="h-2 w-1/2 rounded-full bg-cream/10" />
            <div className="tilet mt-3 opacity-70" />
          </div>
        </div>
      )}
    </div>
  );
}
