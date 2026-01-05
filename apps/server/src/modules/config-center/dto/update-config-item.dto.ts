import { ConfigValueType } from "@prisma/client";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";

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
    z.record(z.string(), z.unknown()),
    z.array(z.unknown()),
  ])
  .refine((val) => val !== undefined && val !== null, {
    message: "value 不能为 undefined 或 null",
  });

export const UpdateConfigItemSchema = z.object({
  value: ConfigValueSchema.optional(),

  valueType: z.nativeEnum(ConfigValueType).optional(),

  description: z
    .string()
    .max(500, "描述最长500个字符")
    .optional()
    .transform((val) => (val ? val.trim() : undefined)),

  isEncrypted: z.boolean().optional(),

  isPublic: z.boolean().optional(),

  isEnabled: z.boolean().optional(),

  // JSON Schema（可选）
  jsonSchema: z
    .object({
      $schema: z.string().optional(),
      type: z.string(),
    })
    .passthrough()
    .optional()
    .nullable(), // 允许设置为 null 来删除 Schema
});

export class UpdateConfigItemDto extends createZodDto(UpdateConfigItemSchema) {}
