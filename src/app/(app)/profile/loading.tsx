import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="flex flex-col items-center px-4 pt-[max(env(safe-area-inset-top),36px)]">
      <Skeleton className="h-[132px] w-[132px] !rounded-full" />
      <Skeleton className="mt-4 h-7 w-44 !rounded-full" />
      <Skeleton className="mt-2 h-4 w-56 !rounded-full" />
      <div className="mt-6 grid w-full grid-cols-2 gap-3">
        <Skeleton className="h-11 !rounded-full" />
        <Skeleton className="h-11 !rounded-full" />
      </div>
      <Skeleton className="mt-9 h-48 w-full !rounded-[26px]" />
      <Skeleton className="mt-9 h-64 w-full !rounded-[24px]" />
    </main>
  );
}
