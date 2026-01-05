// 主题颜色配置（HSL 格式，不含 hsl() 包装）
export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  sidebarBackground: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
}

// 预设主题定义
export interface ThemePreset {
  name: string;
  label: string;
  activeColor: string; // 用于显示的代表色（Tailwind class）
  colors: {
    light: ThemeColors;
    dark: ThemeColors;
  };
}

// 用户主题配置
export interface UserThemeConfig {
  preset: string;
  mode: "light" | "dark" | "system";
  customColors?: Partial<ThemeColors>;
}
