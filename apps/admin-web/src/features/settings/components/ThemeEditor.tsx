import {
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  RotateCcw,
  Upload,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ColorPicker } from "@/components/common/ColorPicker";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getThemePreset } from "@/config/theme-presets";
import { getResolvedColorMode } from "@/lib/theme-utils";
import { useSettingsStore } from "@/stores/settings-store";
import type { ThemeColors } from "@/types/theme";

// 颜色分组配置
const COLOR_GROUPS: {
  title: string;
  description: string;
  fields: { key: keyof ThemeColors; label: string }[];
}[] = [
  {
    title: "基础颜色",
    description: "页面的基础背景和文字颜色",
    fields: [
      { key: "background", label: "背景色" },
      { key: "foreground", label: "前景色" },
    ],
  },
  {
    title: "主要颜色",
    description: "按钮、链接等主要交互元素的颜色",
    fields: [
      { key: "primary", label: "主色" },
      { key: "primaryForeground", label: "主色文字" },
    ],
  },
  {
    title: "次要颜色",
    description: "次要按钮和辅助元素的颜色",
    fields: [
      { key: "secondary", label: "次要色" },
      { key: "secondaryForeground", label: "次要色文字" },
    ],
  },
  {
    title: "强调颜色",
    description: "悬停、选中等状态的颜色",
    fields: [
      { key: "accent", label: "强调色" },
      { key: "accentForeground", label: "强调色文字" },
    ],
  },
  {
    title: "弱化颜色",
    description: "禁用、占位符等弱化元素的颜色",
    fields: [
      { key: "muted", label: "弱化色" },
      { key: "mutedForeground", label: "弱化色文字" },
    ],
  },
  {
    title: "卡片颜色",
    description: "卡片、对话框等容器的颜色",
    fields: [
      { key: "card", label: "卡片背景" },
      { key: "cardForeground", label: "卡片文字" },
      { key: "popover", label: "弹出框背景" },
      { key: "popoverForeground", label: "弹出框文字" },
    ],
  },
  {
    title: "危险颜色",
    description: "删除、错误等危险操作的颜色",
    fields: [
      { key: "destructive", label: "危险色" },
      { key: "destructiveForeground", label: "危险色文字" },
    ],
  },
  {
    title: "边框和输入",
    description: "边框、输入框、焦点环的颜色",
    fields: [
      { key: "border", label: "边框色" },
      { key: "input", label: "输入框边框" },
      { key: "ring", label: "焦点环" },
    ],
  },
  {
    title: "侧边栏",
    description: "侧边栏相关颜色",
    fields: [
      { key: "sidebarBackground", label: "侧边栏背景" },
      { key: "sidebarForeground", label: "侧边栏文字" },
      { key: "sidebarPrimary", label: "侧边栏主色" },
      { key: "sidebarPrimaryForeground", label: "侧边栏主色文字" },
      { key: "sidebarAccent", label: "侧边栏强调色" },
      { key: "sidebarAccentForeground", label: "侧边栏强调色文字" },
      { key: "sidebarBorder", label: "侧边栏边框" },
      { key: "sidebarRing", label: "侧边栏焦点环" },
    ],
  },
  {
    title: "图表颜色",
    description: "图表和数据可视化的颜色",
    fields: [
      { key: "chart1", label: "图表色 1" },
      { key: "chart2", label: "图表色 2" },
      { key: "chart3", label: "图表色 3" },
      { key: "chart4", label: "图表色 4" },
      { key: "chart5", label: "图表色 5" },
    ],
  },
];

export function ThemeEditor() {
  const { themePreset, themeMode, customColors, setCustomColors } =
    useSettingsStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importValue, setImportValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 获取当前预设的颜色
  const currentPreset = useMemo(
    () => getThemePreset(themePreset),
    [themePreset],
  );
  const resolvedMode = getResolvedColorMode(themeMode);
  const presetColors = currentPreset?.colors[resolvedMode];

  // 合并预设和自定义颜色
  const currentColors = useMemo(() => {
    if (!presetColors) return null;
    return { ...presetColors, ...customColors };
  }, [presetColors, customColors]);

  const handleColorChange = useCallback(
    (key: keyof ThemeColors, value: string) => {
      setCustomColors({
        ...customColors,
        [key]: value,
      });
    },
    [customColors, setCustomColors],
  );

  const handleReset = useCallback(() => {
    setCustomColors(null);
    toast.success("已重置为预设颜色");
  }, [setCustomColors]);

  // 导出当前主题配置
  const handleExport = useCallback(() => {
    if (!currentColors) return;

    const exportData = {
      preset: themePreset,
      mode: resolvedMode,
      customColors: customColors || {},
      timestamp: new Date().toISOString(),
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `theme-${themePreset}-${resolvedMode}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("主题配置已导出");
  }, [currentColors, themePreset, resolvedMode, customColors]);

  // 复制为 CSS 变量
  const handleCopyCSS = useCallback(() => {
    if (!currentColors) return;

    const cssLines = Object.entries(currentColors)
      .map(([key, value]) => {
        const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
        return `  --${cssKey}: ${value};`;
      })
      .join("\n");

    const css = `:root {\n${cssLines}\n}`;
    navigator.clipboard.writeText(css);
    toast.success("CSS 变量已复制到剪贴板");
  }, [currentColors]);

  // 导入主题配置
  const handleImport = useCallback(() => {
    try {
      const data = JSON.parse(importValue);
      if (data.customColors && typeof data.customColors === "object") {
        setCustomColors(data.customColors);
        toast.success("主题配置已导入");
        setImportDialogOpen(false);
        setImportValue("");
      } else {
        toast.error("无效的主题配置格式");
      }
    } catch {
      toast.error("JSON 解析失败");
    }
  }, [importValue, setCustomColors]);

  // 从文件导入
  const handleFileImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (data.customColors && typeof data.customColors === "object") {
            setCustomColors(data.customColors);
            toast.success("主题配置已导入");
          } else {
            toast.error("无效的主题配置格式");
          }
        } catch {
          toast.error("文件解析失败");
        }
      };
      reader.readAsText(file);

      // 清空 input 以允许重复选择同一文件
      e.target.value = "";
    },
    [setCustomColors],
  );

  const hasCustomColors = customColors && Object.keys(customColors).length > 0;

  if (!currentColors) return null;

  return (
    <div className="space-y-4">
      {/* 折叠/展开按钮 */}
      <Button
        variant="outline"
        className="w-full justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="flex items-center gap-2">
          <span className="text-sm">高级主题编辑器</span>
          {hasCustomColors && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
              已自定义
            </span>
          )}
        </span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>

      {isExpanded && (
        <div className="rounded-lg border bg-card p-4">
          {/* 工具栏 */}
          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyCSS}
              className="gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" />
              复制 CSS
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              导出
            </Button>
            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Upload className="h-3.5 w-3.5" />
                  导入
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>导入主题配置</DialogTitle>
                  <DialogDescription>
                    粘贴 JSON 格式的主题配置，或选择配置文件
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Textarea
                    placeholder='{"customColors": {...}}'
                    value={importValue}
                    onChange={(e) => setImportValue(e.target.value)}
                    rows={6}
                    className="font-mono text-sm"
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileImport}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    选择文件
                  </Button>
                </div>
                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setImportDialogOpen(false)}
                  >
                    取消
                  </Button>
                  <Button onClick={handleImport} disabled={!importValue.trim()}>
                    导入
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {hasCustomColors && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                重置全部
              </Button>
            )}
          </div>

          {/* 颜色编辑器 */}
          <Accordion type="multiple" className="w-full">
            {COLOR_GROUPS.map((group) => (
              <AccordionItem key={group.title} value={group.title}>
                <AccordionTrigger className="text-sm">
                  {group.title}
                </AccordionTrigger>
                <AccordionContent>
                  <p className="mb-3 text-xs text-muted-foreground">
                    {group.description}
                  </p>
                  <div className="space-y-3">
                    {group.fields.map(({ key, label }) => (
                      <ColorPicker
                        key={key}
                        label={label}
                        value={currentColors[key]}
                        onChange={(value) => handleColorChange(key, value)}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}
    </div>
  );
}
