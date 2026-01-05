import {
  LayoutDashboard,
  Settings,
  Users,
  UserCog,
  Key,
  BookOpen,
  Database,
} from "lucide-react";

import type { MenuItem } from "@/types/menu";

export const menuConfig: MenuItem[] = [
  {
    key: "dashboard",
    label: "仪表盘",
    icon: LayoutDashboard,
    path: "/dashboard",
  },
  {
    key: "config",
    label: "配置中心",
    icon: Database,
    path: "/config/namespaces",
    permission: "config:namespace:list",
  },
  {
    key: "system",
    label: "系统管理",
    icon: Settings,
    children: [
      {
        key: "users",
        label: "用户管理",
        icon: Users,
        path: "/system/users",
        permission: "system:user:list",
      },
      {
        key: "roles",
        label: "角色管理",
        icon: UserCog,
        path: "/system/roles",
        permission: "system:role:list",
      },
      {
        key: "permissions",
        label: "权限管理",
        icon: Key,
        path: "/system/permissions",
        permission: "system:permission:list",
      },
      {
        key: "dictionaries",
        label: "字典管理",
        icon: BookOpen,
        path: "/system/dictionaries",
        permission: "system:dict:list",
      },
    ],
  },
];
