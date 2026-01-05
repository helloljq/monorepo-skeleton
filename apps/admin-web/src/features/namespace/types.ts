import { z } from "zod";

export interface Namespace {
  name: string;
  displayName: string;
  description?: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NamespaceListResponse {
  data: Namespace[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const namespaceFormSchema = z.object({
  name: z
    .string()
    .min(1, "请输入命名空间名称")
    .max(50, "命名空间名称最多50个字符")
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "命名空间名称只能包含小写字母、数字和下划线，且以小写字母开头",
    ),
  displayName: z
    .string()
    .min(1, "请输入显示名称")
    .max(100, "显示名称最多100个字符"),
  description: z.string().max(500, "描述最多500个字符").optional(),
  isEnabled: z.boolean(),
});

export type NamespaceFormData = z.infer<typeof namespaceFormSchema>;
