import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-32 w-full max-w-2xl" />
      <Skeleton className="h-24 w-full max-w-2xl" />
    </div>
  );
}
