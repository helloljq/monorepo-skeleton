import { create } from "zustand";
import { persist } from "zustand/middleware";

import { DEFAULT_THEME_PRESET } from "@/config/theme-presets";
import { applyFullTheme } from "@/lib/theme-utils";
import type { ThemeColors } from "@/types/theme";

type ThemeMode = "light" | "dark" | "system";

interface SettingsState {
  // 颜色模式：浅色/深色/跟随系统
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;

  // 主题预设
  themePreset: string;
  setThemePreset: (preset: string) => void;

  // 自定义颜色覆盖（P1 阶段使用）
  customColors: Partial<ThemeColors> | null;
  setCustomColors: (colors: Partial<ThemeColors> | null) => void;

  // 向后兼容的 theme 别名
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

// 应用主题
function applyTheme(
  preset: string,
  mode: ThemeMode,
  customColors?: Partial<ThemeColors> | null,
) {
  applyFullTheme(preset, mode, customColors || undefined);
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      themeMode: "system",
      themePreset: DEFAULT_THEME_PRESET,
      customColors: null,

      setThemeMode: (mode) => {
        const { themePreset, customColors } = get();
        applyTheme(themePreset, mode, customColors);
        set({ themeMode: mode, theme: mode });
      },

      setThemePreset: (preset) => {
        const { themeMode, customColors } = get();
        applyTheme(preset, themeMode, customColors);
        set({ themePreset: preset });
      },

      setCustomColors: (colors) => {
        const { themePreset, themeMode } = get();
        applyTheme(themePreset, themeMode, colors);
        set({ customColors: colors });
      },

      // 向后兼容
      theme: "system",
      setTheme: (theme) => {
        const { themePreset, customColors } = get();
        applyTheme(themePreset, theme, customColors);
        set({ themeMode: theme, theme });
      },
    }),
    {
      name: "settings-storage",
      // 数据迁移：处理旧版本数据
      migrate: (persistedState: unknown, _version: number) => {
        const state = persistedState as Record<string, unknown>;

        // 如果存在旧的 theme 字段但没有 themeMode，进行迁移
        if (state.theme && !state.themeMode) {
          state.themeMode = state.theme;
        }

        // 如果没有 themePreset，使用默认值
        if (!state.themePreset) {
          state.themePreset = DEFAULT_THEME_PRESET;
        }

        return state as unknown as SettingsState;
      },
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (state) {
          // 水合后应用主题
          applyTheme(
            state.themePreset || DEFAULT_THEME_PRESET,
            state.themeMode || "system",
            state.customColors,
          );
        }
      },
    },
  ),
);

// 监听系统主题变化
if (typeof window !== "undefined") {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      const { themeMode, themePreset, customColors } =
        useSettingsStore.getState();
      if (themeMode === "system") {
        applyTheme(themePreset, "system", customColors);
      }
    });
}
