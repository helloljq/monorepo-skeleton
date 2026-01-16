import { Check } from "lucide-react";

import { themePresets } from "@/config/theme-presets";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings-store";

export function ThemePresetPicker() {
  const { themePreset, setThemePreset } = useSettingsStore();

  return (
    <div className="grid grid-cols-4 gap-3">
      {themePresets.map((preset) => {
        const isActive = themePreset === preset.name;

        return (
          <button
            key={preset.name}
            onClick={() => setThemePreset(preset.name)}
            className={cn(
              "group relative flex items-center gap-2.5 rounded-lg border p-3 transition-all hover:bg-accent/50",
              isActive
                ? "border-primary bg-accent ring-1 ring-primary/20"
                : "border-border",
            )}
          >
            {/* 颜色指示器 */}
            <span
              className={cn(
                "h-5 w-5 shrink-0 rounded-full shadow-sm ring-1 ring-inset ring-black/10",
                preset.activeColor,
              )}
            />
            {/* 主题名称 */}
            <span className="text-sm font-medium">{preset.label}</span>
            {/* 选中指示器 */}
            {isActive && (
              <Check className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
}
