import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const UpdateDictionarySchema = z.object({
  value: z
    .union([
      z.record(z.string(), z.unknown()),
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
    ])
    .optional(),
  label: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).optional().nullable(),
  sort: z.number().int().min(0).optional(),
  isEnabled: z.boolean().optional(),
  version: z.string().max(20).trim().optional(), // 配置版本号（可选）
});

export class UpdateDictionaryDto extends createZodDto(UpdateDictionarySchema) {}
