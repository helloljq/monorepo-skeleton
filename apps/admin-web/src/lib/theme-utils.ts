import type { ThemeColors, ThemePreset } from "@/types/theme";
import { getThemePreset } from "@/config/theme-presets";

/**
 * 将 camelCase 转换为 kebab-case CSS 变量名
 * 例如：primaryForeground -> primary-foreground
 *       chart1 -> chart-1
 *       sidebarPrimaryForeground -> sidebar-primary-foreground
 */
function toKebabCase(str: string): string {
  return (
    str
      // 在大写字母前插入连字符
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      // 在数字前插入连字符（如 chart1 -> chart-1）
      .replace(/([a-zA-Z])(\d)/g, "$1-$2")
      .toLowerCase()
  );
}

// 应用主题颜色到 CSS 变量
export function applyThemeColors(
  colors: ThemeColors,
  customColors?: Partial<ThemeColors>,
) {
  const root = document.documentElement;
  const finalColors = { ...colors, ...customColors };

  Object.entries(finalColors).forEach(([key, value]) => {
    const cssVar = `--${toKebabCase(key)}`;
    root.style.setProperty(cssVar, value);
  });
}

// 应用主题预设
export function applyThemePreset(
  presetName: string,
  mode: "light" | "dark",
  customColors?: Partial<ThemeColors>,
) {
  const preset = getThemePreset(presetName);
  if (!preset) {
    console.warn(`Theme preset "${presetName}" not found`);
    return;
  }

  const colors = preset.colors[mode];
  applyThemeColors(colors, customColors);
}

// 清除所有内联样式，恢复 CSS 文件中的默认值
export function resetThemeStyles() {
  const root = document.documentElement;
  // 移除所有通过 JS 设置的内联样式
  root.removeAttribute("style");
}

// 获取当前实际的颜色模式（处理 system 模式）
export function getResolvedColorMode(
  mode: "light" | "dark" | "system",
): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return mode;
}

// 应用完整主题（预设 + 模式）
export function applyFullTheme(
  presetName: string,
  mode: "light" | "dark" | "system",
  customColors?: Partial<ThemeColors>,
) {
  const resolvedMode = getResolvedColorMode(mode);

  // 先应用 light/dark class
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolvedMode);

  // 应用主题颜色
  applyThemePreset(presetName, resolvedMode, customColors);
}

// 导出主题配置为 CSS 字符串（用于复制）
export function exportThemeToCss(preset: ThemePreset): string {
  const { light, dark } = preset.colors;

  const formatColors = (colors: ThemeColors, indent: string = "  "): string => {
    return Object.entries(colors)
      .map(([key, value]) => `${indent}--${toKebabCase(key)}: ${value};`)
      .join("\n");
  };

  return `/* ${preset.label} Theme */
:root {
${formatColors(light)}
}

.dark {
${formatColors(dark)}
}`;
}
