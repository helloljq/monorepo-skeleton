/**
 * 时间工具函数
 */

/**
 * 解析时间段为秒数
 * 支持格式:
 * - number: 直接作为秒数返回
 * - string: "30s", "15m", "1h", "7d"
 *
 * @param value 时间段（秒数或字符串）
 * @returns 秒数
 * @throws Error 如果字符串格式无效
 */
export function parseDurationToSeconds(value: string | number): number {
  // If already a number, return directly (assumed to be seconds)
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Invalid duration: ${value}. Must be a positive number.`);
    }
    return value;
  }

  const trimmed = value.trim();
  const match = /^(\d+)\s*(s|m|h|d)$/i.exec(trimmed);
  if (!match) {
    throw new Error(
      `Invalid duration format: "${value}". Expected like "15m", "7d", "30s", "1h".`,
    );
  }
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid duration amount: "${value}"`);
  }

  switch (unit) {
    case "s":
      return amount;
    case "m":
      return amount * 60;
    case "h":
      return amount * 60 * 60;
    case "d":
      return amount * 24 * 60 * 60;
    default:
      throw new Error(`Unsupported duration unit: "${value}"`);
  }
}
