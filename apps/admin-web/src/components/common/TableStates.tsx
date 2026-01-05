import { Skeleton } from "@/components/ui/skeleton";

interface TableLoadingProps {
  rows?: number;
}

export function TableLoading({ rows = 3 }: TableLoadingProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

interface TableEmptyProps {
  message?: string;
}

export function TableEmpty({ message = "暂无数据" }: TableEmptyProps) {
  return (
    <div className="flex h-64 items-center justify-center text-muted-foreground">
      {message}
    </div>
  );
}
