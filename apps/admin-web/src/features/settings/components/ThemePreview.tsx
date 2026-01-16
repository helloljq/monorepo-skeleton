import { AlertTriangle } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getThemePreset } from "@/config/theme-presets";
import { getContrastRatio, hslStringToHex, hexToRgb } from "@/lib/color-utils";
import { getResolvedColorMode } from "@/lib/theme-utils";
import { useSettingsStore } from "@/stores/settings-store";

// WCAG AA 标准：普通文本需要 4.5:1，大文本需要 3:1
const WCAG_AA_NORMAL = 4.5;
const WCAG_AA_LARGE = 3;

interface ContrastCheckBase {
  name: string;
  foreground: string;
  background: string;
}

interface ContrastCheck extends ContrastCheckBase {
  ratio: number;
  passesAA: boolean;
  passesAALarge: boolean;
}

export function ThemePreview() {
  const { themePreset, themeMode, customColors } = useSettingsStore();

  // 计算对比度检查结果
  const contrastChecks = useMemo((): ContrastCheck[] => {
    const preset = getThemePreset(themePreset);
    if (!preset) return [];

    const resolvedMode = getResolvedColorMode(themeMode);
    const colors = { ...preset.colors[resolvedMode], ...customColors };

    const checks: ContrastCheckBase[] = [
      {
        name: "主色文字",
        foreground: colors.primaryForeground,
        background: colors.primary,
      },
      {
        name: "次要色文字",
        foreground: colors.secondaryForeground,
        background: colors.secondary,
      },
      {
        name: "页面文字",
        foreground: colors.foreground,
        background: colors.background,
      },
      {
        name: "弱化文字",
        foreground: colors.mutedForeground,
        background: colors.background,
      },
    ];

    return checks.map((check) => {
      const fgHex = hslStringToHex(check.foreground);
      const bgHex = hslStringToHex(check.background);
      const fgRgb = hexToRgb(fgHex);
      const bgRgb = hexToRgb(bgHex);

      if (!fgRgb || !bgRgb) {
        return { ...check, ratio: 0, passesAA: false, passesAALarge: false };
      }

      const ratio = getContrastRatio(fgRgb, bgRgb);
      return {
        ...check,
        ratio,
        passesAA: ratio >= WCAG_AA_NORMAL,
        passesAALarge: ratio >= WCAG_AA_LARGE,
      };
    });
  }, [themePreset, themeMode, customColors]);

  // 检查是否有不符合 AA 标准的颜色组合
  const hasContrastIssues = contrastChecks.some((check) => !check.passesAA);

  return (
    <div
      className="rounded-lg border bg-card p-4"
      role="region"
      aria-label="主题预览"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-card-foreground">
          主题预览
        </span>
        {hasContrastIssues && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"
                  role="alert"
                >
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>对比度警告</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <div className="space-y-2 text-xs">
                  <p className="font-medium">以下颜色组合可能影响可读性：</p>
                  <ul className="space-y-1">
                    {contrastChecks
                      .filter((check) => !check.passesAA)
                      .map((check) => (
                        <li
                          key={check.name}
                          className="flex items-center justify-between gap-4"
                        >
                          <span>{check.name}</span>
                          <span className="font-mono text-amber-600 dark:text-amber-400">
                            {check.ratio.toFixed(2)}:1
                          </span>
                        </li>
                      ))}
                  </ul>
                  <p className="text-muted-foreground">
                    WCAG AA 标准要求至少 4.5:1
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="space-y-4">
        {/* 按钮预览 */}
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="按钮样式预览"
        >
          <Button size="sm">主要按钮</Button>
          <Button size="sm" variant="secondary">
            次要按钮
          </Button>
          <Button size="sm" variant="outline">
            边框按钮
          </Button>
          <Button size="sm" variant="destructive">
            危险按钮
          </Button>
        </div>

        {/* 输入框预览 */}
        <Input
          placeholder="输入框预览..."
          className="max-w-xs"
          aria-label="输入框样式预览"
        />

        {/* 文本预览 */}
        <div
          className="space-y-1 text-sm"
          role="group"
          aria-label="文本颜色预览"
        >
          <p className="text-foreground">这是主要文本颜色</p>
          <p className="text-muted-foreground">这是次要文本颜色</p>
        </div>

        {/* 颜色块预览 */}
        <div className="flex gap-2" role="group" aria-label="颜色块预览">
          <div
            className="h-8 w-8 rounded bg-primary"
            title="Primary"
            role="img"
            aria-label="主色"
          />
          <div
            className="h-8 w-8 rounded bg-secondary"
            title="Secondary"
            role="img"
            aria-label="次要色"
          />
          <div
            className="h-8 w-8 rounded bg-accent"
            title="Accent"
            role="img"
            aria-label="强调色"
          />
          <div
            className="h-8 w-8 rounded bg-muted"
            title="Muted"
            role="img"
            aria-label="弱化色"
          />
          <div
            className="h-8 w-8 rounded bg-destructive"
            title="Destructive"
            role="img"
            aria-label="危险色"
          />
        </div>
      </div>
    </div>
  );
}
