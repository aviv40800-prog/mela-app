import { ListSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="px-4 pt-[max(env(safe-area-inset-top),24px)]">
      <Skeleton className="h-9 w-32 !rounded-full" />
      <Skeleton className="mt-6 h-36 !rounded-[26px]" />
      <div className="mt-8 flex gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[72px] w-[72px] !rounded-full" />
        ))}
      </div>
      <div className="mt-8">
        <ListSkeleton rows={4} />
      </div>
    </main>
  );
}
