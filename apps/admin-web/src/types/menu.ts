import type { LucideIcon } from "lucide-react";

export interface MenuItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  path?: string;
  children?: MenuItem[];
  badge?: number | string;
  permission?: string;
}
