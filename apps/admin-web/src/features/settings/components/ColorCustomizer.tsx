import { RotateCcw } from "lucide-react";
import { useMemo } from "react";

import { ColorPicker } from "@/components/common/ColorPicker";
import { Button } from "@/components/ui/button";
import { getThemePreset } from "@/config/theme-presets";
import { getResolvedColorMode } from "@/lib/theme-utils";
import { useSettingsStore } from "@/stores/settingsStore";
import type { ThemeColors } from "@/types/theme";

// 主要可自定义的颜色字段
const PRIMARY_COLOR_FIELDS: { key: keyof ThemeColors; label: string }[] = [
  { key: "primary", label: "主色" },
  { key: "primaryForeground", label: "主色文字" },
];

export function ColorCustomizer() {
  const { themePreset, themeMode, customColors, setCustomColors } =
    useSettingsStore();

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

  const handleColorChange = (key: keyof ThemeColors, value: string) => {
    setCustomColors({
      ...customColors,
      [key]: value,
    });
  };

  const handleReset = () => {
    setCustomColors(null);
  };

  const hasCustomColors = customColors && Object.keys(customColors).length > 0;

  if (!currentColors) return null;

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">自定义颜色</span>
        {hasCustomColors && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-7 gap-1.5 text-xs"
          >
            <RotateCcw className="h-3 w-3" />
            重置
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {PRIMARY_COLOR_FIELDS.map(({ key, label }) => (
          <ColorPicker
            key={key}
            label={label}
            value={currentColors[key]}
            onChange={(value) => handleColorChange(key, value)}
          />
        ))}
      </div>

      {hasCustomColors && (
        <p className="text-xs text-muted-foreground">
          已应用自定义颜色，点击"重置"恢复为预设值
        </p>
      )}
    </div>
  );
}
