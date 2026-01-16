import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import {
  zNonEmptyTrimmedString,
  zPlainText,
  zTrimmedEmail,
} from "../../../common/validation/zod-helpers";

/**
 * Password validation schema with security requirements
 * - Minimum 8 characters, maximum 128 characters
 * - Must contain at least one uppercase letter
 * - Must contain at least one lowercase letter
 * - Must contain at least one digit
 */
const passwordSchema = z
  .string()
  .min(8, "密码长度至少为 8 个字符")
  .max(128, "密码长度不能超过 128 个字符")
  .regex(/[A-Z]/, "密码必须包含至少一个大写字母")
  .regex(/[a-z]/, "密码必须包含至少一个小写字母")
  .regex(/[0-9]/, "密码必须包含至少一个数字");

export const RegisterSchema = z.object({
  email: zTrimmedEmail(),
  password: passwordSchema,
  name: zPlainText().max(100).optional(),
});

export class RegisterDto extends createZodDto(RegisterSchema) {}

export const LoginSchema = z.object({
  email: zTrimmedEmail(),
  password: z
    .string()
    .min(1, "密码不能为空")
    .max(128, "密码长度不能超过 128 个字符"),
  deviceId: zNonEmptyTrimmedString().describe(
    "Device ID for multi-device support",
  ),
});

export class LoginDto extends createZodDto(LoginSchema) {}

export const RefreshTokenSchema = z.object({
  refreshToken: zNonEmptyTrimmedString().max(
    2000,
    "Refresh Token 长度不能超过 2000 个字符",
  ),
  deviceId: zNonEmptyTrimmedString(),
});

export class RefreshTokenDto extends createZodDto(RefreshTokenSchema) {}

// Web Cookie 模式：refreshToken 从 HttpOnly Cookie 读取，Body 仅传 deviceId
export const WebRefreshSchema = z.object({
  deviceId: zNonEmptyTrimmedString(),
});

export class WebRefreshDto extends createZodDto(WebRefreshSchema) {}

export const LogoutSchema = z.object({
  deviceId: zNonEmptyTrimmedString().describe(
    "Device ID for multi-device logout",
  ),
});

export class LogoutDto extends createZodDto(LogoutSchema) {}

// ============================================
// 手机号登录相关 DTO
// ============================================

/**
 * 中国大陆手机号格式
 */
const phoneSchema = z.string().regex(/^1[3-9]\d{9}$/, "手机号格式不正确");

/**
 * 6 位数字验证码
 */
const smsCodeSchema = z.string().regex(/^\d{6}$/, "验证码必须为 6 位数字");

export const SendSmsCodeSchema = z.object({
  phone: phoneSchema,
});

export class SendSmsCodeDto extends createZodDto(SendSmsCodeSchema) {}

export const PhoneLoginSchema = z.object({
  phone: phoneSchema,
  code: smsCodeSchema,
  deviceId: zNonEmptyTrimmedString().describe(
    "Device ID for multi-device support",
  ),
});

export class PhoneLoginDto extends createZodDto(PhoneLoginSchema) {}

// ============================================
// Response DTOs (for Swagger documentation)
// ============================================

/**
 * 注册成功响应
 */
export class RegisterResponseDto {
  @ApiProperty({
    description: "用户 ID（Public ID）",
    format: "uuid",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  id!: string;

  @ApiProperty({ description: "邮箱", example: "user@example.com" })
  email!: string;

  @ApiPropertyOptional({ description: "用户名", example: "John Doe" })
  name?: string | null;
}

/**
 * 登录/刷新 Token 成功响应
 */
export class TokenResponseDto {
  @ApiProperty({
    description: "访问令牌",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  accessToken!: string;

  @ApiProperty({
    description: "刷新令牌",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  refreshToken!: string;

  @ApiProperty({
    description: "访问令牌有效期（秒）",
    example: 900,
  })
  accessExpiresInSeconds!: number;
}

/**
 * Web 登录响应（不返回 Token）
 */
export class WebLoginResponseDto {
  @ApiProperty({
    description: "用户 ID（Public ID）",
    format: "uuid",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  id!: string;

  @ApiProperty({
    description: "邮箱",
    example: "user@example.com",
    nullable: true,
  })
  email!: string | null;

  @ApiPropertyOptional({ description: "用户名", example: "John Doe" })
  name?: string | null;

  @ApiProperty({ description: "用户状态", example: "ACTIVE" })
  status!: string;

  @ApiPropertyOptional({ description: "头像 URL" })
  avatar?: string | null;

  @ApiProperty({ description: "角色列表", example: ["ADMIN"], isArray: true })
  roles!: string[];
}

/**
 * 登出成功响应
 */
export class LogoutResponseDto {
  @ApiProperty({
    description: "登出成功消息",
    example: "Logged out successfully",
  })
  message!: string;
}
