import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const UpdateNamespaceSchema = z.object({
  displayName: z
    .string()
    .min(1, "显示名称不能为空")
    .max(100, "显示名称最长100个字符")
    .trim()
    .optional(),

  description: z
    .string()
    .max(500, "描述最长500个字符")
    .optional()
    .transform((val) => (val ? val.trim() : undefined)),

  isEnabled: z.boolean().optional(),
});

export class UpdateNamespaceDto extends createZodDto(UpdateNamespaceSchema) {}
