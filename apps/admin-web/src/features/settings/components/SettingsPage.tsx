import {
  ArrowLeft,
  Monitor,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUIStore } from "@/stores/uiStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { ColorCustomizer } from "./ColorCustomizer";
import { ThemeEditor } from "./ThemeEditor";
import { ThemePresetPicker } from "./ThemePresetPicker";
import { ThemePreview } from "./ThemePreview";

export function SettingsPage() {
  const navigate = useNavigate();
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore();
  const { themeMode, setThemeMode } = useSettingsStore();

  const themeOptions = [
    { value: "light", label: "浅色", icon: Sun },
    { value: "system", label: "跟随系统", icon: Monitor },
    { value: "dark", label: "深色", icon: Moon },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">设置</h1>
          <p className="text-muted-foreground">管理您的应用偏好设置</p>
        </div>
      </div>

      {/* 外观设置 */}
      <Card>
        <CardHeader>
          <CardTitle>外观</CardTitle>
          <CardDescription>自定义应用的外观主题</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 颜色模式 */}
          <div className="space-y-3">
            <Label>颜色模式</Label>
            <div className="grid grid-cols-3 gap-3">
              {themeOptions.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setThemeMode(value)}
                  className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors hover:bg-accent ${
                    themeMode === value
                      ? "border-primary bg-accent"
                      : "border-border"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 主题配色 */}
          <div className="space-y-3">
            <Label>主题配色</Label>
            <ThemePresetPicker />
          </div>

          {/* 主题预览 */}
          <ThemePreview />

          {/* 快速自定义主色（P1） */}
          <ColorCustomizer />

          {/* 高级主题编辑器（P2） */}
          <ThemeEditor />
        </CardContent>
      </Card>

      {/* 布局设置 */}
      <Card>
        <CardHeader>
          <CardTitle>布局</CardTitle>
          <CardDescription>自定义应用的布局设置</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              {sidebarCollapsed ? (
                <PanelLeftClose className="h-5 w-5 text-muted-foreground" />
              ) : (
                <PanelLeft className="h-5 w-5 text-muted-foreground" />
              )}
              <div className="space-y-0.5">
                <Label className="text-base">默认折叠侧边栏</Label>
                <p className="text-sm text-muted-foreground">
                  启用后侧边栏默认收起，节省屏幕空间
                </p>
              </div>
            </div>
            <Switch
              checked={sidebarCollapsed}
              onCheckedChange={setSidebarCollapsed}
            />
          </div>
        </CardContent>
      </Card>

      {/* 关于 */}
      <Card>
        <CardHeader>
          <CardTitle>关于</CardTitle>
          <CardDescription>应用信息</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">应用名称</span>
              <span>i 54KB 管理后台</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">版本</span>
              <span>1.0.0</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
