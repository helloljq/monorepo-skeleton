import type { ValueType } from "@/features/config-item/types";

export class ValueParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValueParseError";
  }
}

/**
 * 将字符串值解析为对应类型的值
 */
export function parseConfigValue(value: string, valueType: ValueType): unknown {
  switch (valueType) {
    case "JSON":
      try {
        return JSON.parse(value);
      } catch {
        throw new ValueParseError("JSON 格式不正确");
      }

    case "NUMBER": {
      const num = Number(value);
      if (isNaN(num)) {
        throw new ValueParseError("数字格式不正确");
      }
      return num;
    }

    case "BOOLEAN":
      return value === "true";

    case "STRING":
    default:
      return value;
  }
}

/**
 * 将任意类型的值序列化为字符串（用于表单显示）
 */
export function serializeConfigValue(value: unknown): string {
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}
