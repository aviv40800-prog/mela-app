export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const cls = { sm: "text-2xl", md: "text-3xl", lg: "text-6xl" }[size];
  return (
    <span dir="ltr" className={`font-display font-bold tracking-[0.28em] gold-text animate-shimmer ${cls}`}>
      MELA
    </span>
  );
}
