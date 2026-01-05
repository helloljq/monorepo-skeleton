import { useCallback, useId, useMemo, useState } from "react";
import { HexColorPicker } from "react-colorful";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { hexToHslString, hslStringToHex } from "@/lib/color-utils";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  label: string;
  value: string; // HSL 字符串，如 "210 40% 98%"
  onChange: (value: string) => void;
  className?: string;
}

export function ColorPicker({
  label,
  value,
  onChange,
  className,
}: ColorPickerProps) {
  const id = useId();
  // 将 HSL 字符串转换为 HEX 用于颜色选择器
  const hexValue = useMemo(() => hslStringToHex(value), [value]);

  // 输入框使用本地状态，仅在编辑时独立
  const [localInputValue, setLocalInputValue] = useState<string | null>(null);
  const inputValue = localInputValue ?? hexValue;

  const handleColorChange = useCallback(
    (hex: string) => {
      setLocalInputValue(null);
      onChange(hexToHslString(hex));
    },
    [onChange],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalInputValue(newValue);

      // 验证是否为有效的 HEX 颜色
      if (/^#[0-9a-fA-F]{6}$/.test(newValue)) {
        onChange(hexToHslString(newValue));
      }
    },
    [onChange],
  );

  const handleInputBlur = useCallback(() => {
    // 清除本地状态，恢复为外部值
    setLocalInputValue(null);
  }, []);

  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <Label id={`${id}-label`} className="shrink-0 text-sm">
        {label}
      </Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-9 w-28 justify-start gap-2 px-2"
            style={{ backgroundColor: hexValue }}
            aria-label={`选择${label}颜色，当前值 ${hexValue}`}
            aria-describedby={`${id}-label`}
          >
            <span
              className="h-5 w-5 shrink-0 rounded border"
              style={{ backgroundColor: hexValue }}
              aria-hidden="true"
            />
            <span className="font-mono text-xs text-foreground">
              {hexValue}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-3"
          align="end"
          aria-label={`${label}颜色选择器`}
        >
          <div className="space-y-3" role="group" aria-label="颜色选择">
            <HexColorPicker
              color={hexValue}
              onChange={handleColorChange}
              aria-label={`${label}颜色选择区域`}
            />
            <div className="flex items-center gap-2">
              <span
                className="h-8 w-8 shrink-0 rounded border"
                style={{ backgroundColor: hexValue }}
                role="img"
                aria-label={`当前颜色预览: ${hexValue}`}
              />
              <Input
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                className="h-8 font-mono text-sm"
                placeholder="#000000"
                aria-label={`${label}十六进制颜色值`}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
