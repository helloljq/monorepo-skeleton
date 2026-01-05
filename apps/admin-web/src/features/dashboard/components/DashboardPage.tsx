import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCog, Key, BookOpen } from "lucide-react";

const stats = [
  {
    title: "用户总数",
    value: "1,234",
    icon: Users,
    description: "系统注册用户",
  },
  {
    title: "角色数量",
    value: "12",
    icon: UserCog,
    description: "已配置角色",
  },
  {
    title: "权限数量",
    value: "48",
    icon: Key,
    description: "系统权限项",
  },
  {
    title: "字典数量",
    value: "26",
    icon: BookOpen,
    description: "数据字典",
  },
];

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">仪表盘</h1>
        <p className="text-muted-foreground">欢迎回来，这是系统概览。</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>快速入口</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            使用左侧菜单导航到各管理模块。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
