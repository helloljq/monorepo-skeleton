import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const CreateDictionarySchema = z.object({
  type: z
    .string()
    .min(1)
    .max(50)
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "Type must be lowercase letters, numbers, and underscores",
    )
    .trim(),
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(
      /^[A-Z][A-Z0-9_]*$/,
      "Key must be uppercase letters, numbers, and underscores",
    )
    .trim(),
  value: z.union([
    z.record(z.string(), z.unknown()),
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
  ]),
  label: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
  sort: z.number().int().min(0).default(0),
  isEnabled: z.boolean().default(true),
  version: z.string().max(20).trim().optional(), // 配置版本号（可选）
});

export class CreateDictionaryDto extends createZodDto(CreateDictionarySchema) {}
