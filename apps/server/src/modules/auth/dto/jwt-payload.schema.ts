import { z } from "zod";

/**
 * JWT Payload 验证 Schema
 * 用于验证解码后的 JWT token 结构
 */
export const JwtPayloadSchema = z.object({
  sub: z.number().int(),
  email: z.string().email(),
  roles: z.array(z.string()).default([]),
});

/**
 * JWT Payload 类型定义
 */
export interface JwtPayload {
  sub: number;
  email: string;
  roles: string[];
}

/**
 * Request 上下文中的用户对象类型
 */
export interface RequestUser {
  userId: number;
  email: string;
  roles: string[];
  permissions?: string[]; // 由 PermissionsGuard 按需填充
}
