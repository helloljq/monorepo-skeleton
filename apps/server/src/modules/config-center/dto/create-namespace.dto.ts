import { createZodDto } from "nestjs-zod";
import { z } from "zod";

/**
 * 保留的命名空间名称
 * 避免与 API 路由冲突
 */
const RESERVED_NAMESPACE_NAMES = [
  "namespaces",
  "batch",
  "health",
  "metrics",
  "config",
];

export const CreateNamespaceSchema = z.object({
  name: z
    .string()
    .min(1, "命名空间名称不能为空")
    .max(50, "命名空间名称最长50个字符")
    .trim()
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "命名空间名称必须以小写字母开头，只能包含小写字母、数字和下划线",
    )
    .refine((val) => !RESERVED_NAMESPACE_NAMES.includes(val), {
      message: "命名空间名称不能使用保留字",
    }),

  displayName: z
    .string()
    .min(1, "显示名称不能为空")
    .max(100, "显示名称最长100个字符")
    .trim(),

  description: z
    .string()
    .max(500, "描述最长500个字符")
    .optional()
    .transform((val) => (val ? val.trim() : undefined)),

  isEnabled: z.boolean().default(true),
});

export class CreateNamespaceDto extends createZodDto(CreateNamespaceSchema) {}
