import { ConfigValueType } from "@prisma/client";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";

/**
 * 保留的配置项 key
 * 避免与 API 路由冲突
 */
const RESERVED_CONFIG_KEYS = ["batch", "history", "rollback", "meta"];

/**
 * 配置值类型校验
 * 支持: string, number, boolean, object, array
 * 禁止: undefined, null (明确拒绝)
 */
const ConfigValueSchema = z
  .union([
    z.string(),
    z.number(),
    z.boolean(),
    z.record(z.string(), z.unknown()), // object
    z.array(z.unknown()), // array
  ])
  .refine((val) => val !== undefined && val !== null, {
    message: "value 不能为 undefined 或 null",
  });

export const CreateConfigItemSchema = z.object({
  key: z
    .string()
    .min(1, "配置项 key 不能为空")
    .max(100, "配置项 key 最长100个字符")
    .trim()
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "key 必须以小写字母开头，只能包含小写字母、数字和下划线",
    )
    .refine((val) => !RESERVED_CONFIG_KEYS.includes(val), {
      message: "配置项 key 不能使用保留字",
    }),

  value: ConfigValueSchema,

  valueType: z.nativeEnum(ConfigValueType).default(ConfigValueType.JSON),

  description: z
    .string()
    .max(500, "描述最长500个字符")
    .optional()
    .transform((val) => (val ? val.trim() : undefined)),

  isEncrypted: z.boolean().default(false),

  isPublic: z.boolean().default(false),

  isEnabled: z.boolean().default(true),

  // JSON Schema（可选）
  jsonSchema: z
    .object({
      $schema: z.string().optional(),
      type: z.string(),
    })
    .passthrough() // 允许其他 JSON Schema 字段
    .optional(),
});

export class CreateConfigItemDto extends createZodDto(CreateConfigItemSchema) {}
