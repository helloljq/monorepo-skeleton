import { createHash } from "crypto";

/**
 * 计算字符串的 SHA256 hash，返回十六进制格式
 * 用于 token 存储、幂等性签名等安全场景
 */
export function hashSha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
