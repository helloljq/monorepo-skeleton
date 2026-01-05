import { Badge } from "@/components/ui/badge";
import type { ValueType } from "../types";

interface ValueTypeBadgeProps {
  type: ValueType;
}

const VALUE_TYPE_COLORS: Record<ValueType, string> = {
  JSON: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  STRING: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  NUMBER:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  BOOLEAN:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

export function ValueTypeBadge({ type }: ValueTypeBadgeProps) {
  return (
    <Badge variant="outline" className={VALUE_TYPE_COLORS[type]}>
      {type}
    </Badge>
  );
}
