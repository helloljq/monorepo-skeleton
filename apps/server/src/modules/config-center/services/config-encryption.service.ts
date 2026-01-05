import { Injectable } from "@nestjs/common";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

import { BusinessException } from "../../../common/errors/business.exception";
import { ApiErrorCode } from "../../../common/errors/error-codes";
import { AppConfigService } from "../../../config/app-config.service";

/**
 * 配置加密服务
 *
 * 使用 AES-256-GCM 算法对敏感配置进行加密存储
 * 密钥来源: 环境变量 CONFIG_ENCRYPTION_KEY (64位hex字符串)
 *
 * 存储格式: `iv:authTag:ciphertext` (均为 Base64 编码)
 *
 * @example
 * ```typescript
 * // 加密
 * const encrypted = encryptionService.encrypt('sensitive-data');
 * // => "base64iv:base64tag:base64cipher"
 *
 * // 解密
 * const decrypted = encryptionService.decrypt(encrypted);
 * // => "sensitive-data"
 * ```
 */
@Injectable()
export class ConfigEncryptionService {
  private readonly algorithm = "aes-256-gcm";
  private readonly key: Buffer | null;

  constructor(private readonly configService: AppConfigService) {
    const keyHex = this.configService.configEncryptionKey;

    // 允许未配置密钥（开发环境），但使用时会抛出友好错误
    if (keyHex && keyHex.length === 64) {
      this.key = Buffer.from(keyHex, "hex");
    } else {
      this.key = null;
    }
  }

  /**
   * 检查加密功能是否可用
   */
  isAvailable(): boolean {
    return this.key !== null;
  }

  /**
   * 确保密钥已配置,否则抛出业务异常
   */
  private ensureKeyAvailable(): void {
    if (!this.key) {
      throw new BusinessException({
        code: ApiErrorCode.CONFIG_ENCRYPTION_FAILED,
        message: "加密功能未配置，请设置 CONFIG_ENCRYPTION_KEY 环境变量",
      });
    }
  }

  /**
   * 加密字符串
   *
   * @param plaintext - 明文字符串
   * @returns 加密后的字符串，格式: `iv:authTag:ciphertext` (Base64)
   * @throws BusinessException 如果加密密钥未配置
   */
  encrypt(plaintext: string): string {
    this.ensureKeyAvailable();

    const iv = randomBytes(12); // GCM 推荐 12 字节 IV
    const cipher = createCipheriv(this.algorithm, this.key!, iv);

    let encrypted = cipher.update(plaintext, "utf8", "base64");
    encrypted += cipher.final("base64");

    const authTag = cipher.getAuthTag();

    // 格式: iv:authTag:ciphertext (all base64)
    return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
  }

  /**
   * 解密字符串
   *
   * @param encrypted - 加密字符串，格式: `iv:authTag:ciphertext` (Base64)
   * @returns 解密后的明文字符串
   * @throws BusinessException 如果加密密钥未配置或解密失败
   */
  decrypt(encrypted: string): string {
    this.ensureKeyAvailable();

    try {
      const [ivB64, authTagB64, ciphertext] = encrypted.split(":");

      if (!ivB64 || !authTagB64 || !ciphertext) {
        throw new Error("Invalid encrypted string format");
      }

      const iv = Buffer.from(ivB64, "base64");
      const authTag = Buffer.from(authTagB64, "base64");

      const decipher = createDecipheriv(this.algorithm, this.key!, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext, "base64", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      throw new BusinessException({
        code: ApiErrorCode.CONFIG_DECRYPTION_FAILED,
        message:
          error instanceof Error ? `解密失败: ${error.message}` : "解密失败",
      });
    }
  }
}
