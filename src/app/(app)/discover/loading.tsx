import { CardSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="px-3 pt-[max(env(safe-area-inset-top),12px)]">
      <div className="flex h-14 items-center justify-between px-2">
        <div className="skeleton h-6 w-24 rounded-full" />
        <div className="skeleton h-7 w-24 rounded-full" />
      </div>
      <CardSkeleton />
    </main>
  );
}
