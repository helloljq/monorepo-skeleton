// HSL 颜色工具函数

export interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

export interface RGB {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

// 解析 CSS HSL 字符串 "210 40% 98%" 为 HSL 对象
export function parseHslString(hslString: string): HSL | null {
  const match = hslString.match(/^([\d.]+)\s+([\d.]+)%?\s+([\d.]+)%?$/);
  if (!match) return null;

  return {
    h: parseFloat(match[1]),
    s: parseFloat(match[2]),
    l: parseFloat(match[3]),
  };
}

// HSL 对象转换为 CSS HSL 字符串 "210 40% 98%"
export function hslToString(hsl: HSL): string {
  return `${Math.round(hsl.h * 10) / 10} ${Math.round(hsl.s * 10) / 10}% ${Math.round(hsl.l * 10) / 10}%`;
}

// HSL 转 RGB
export function hslToRgb(hsl: HSL): RGB {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

// RGB 转 HSL
export function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// RGB 转 HEX
export function rgbToHex(rgb: RGB): string {
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

// HEX 转 RGB
export function hexToRgb(hex: string): RGB | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

// CSS HSL 字符串转 HEX
export function hslStringToHex(hslString: string): string {
  const hsl = parseHslString(hslString);
  if (!hsl) return "#000000";
  return rgbToHex(hslToRgb(hsl));
}

// HEX 转 CSS HSL 字符串
export function hexToHslString(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "0 0% 0%";
  return hslToString(rgbToHsl(rgb));
}

// 计算颜色的相对亮度（用于对比度计算）
export function getRelativeLuminance(rgb: RGB): number {
  const sRGB = [rgb.r, rgb.g, rgb.b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
}

// 计算两个颜色之间的对比度
export function getContrastRatio(color1: RGB, color2: RGB): number {
  const l1 = getRelativeLuminance(color1);
  const l2 = getRelativeLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// 检查对比度是否符合 WCAG AA 标准（4.5:1 用于普通文本）
export function meetsContrastAA(foreground: RGB, background: RGB): boolean {
  return getContrastRatio(foreground, background) >= 4.5;
}

// 根据背景色自动选择前景色（黑或白）
export function getContrastForeground(background: HSL): HSL {
  const rgb = hslToRgb(background);
  const luminance = getRelativeLuminance(rgb);
  // 如果背景较亮，使用深色前景；否则使用浅色前景
  return luminance > 0.179 ? { h: 0, s: 0, l: 10 } : { h: 0, s: 0, l: 98 };
}
