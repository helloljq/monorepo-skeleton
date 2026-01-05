import { z } from "zod";

export interface Permission {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  resource: string;
  action: string;
  module?: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionListResponse {
  data: Permission[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const permissionFormSchema = z.object({
  code: z
    .string()
    .min(3, "权限编码至少3个字符")
    .max(100, "权限编码最多100个字符")
    .regex(
      /^[a-z][a-z0-9]*:[a-z][a-z0-9-]*$/,
      "格式：module:resource-action，如 system:user-list",
    ),
  name: z.string().min(1, "请输入权限名称").max(100),
  description: z.string().max(500, "描述最多500个字符").optional(),
  resource: z.string().min(1, "请输入资源").max(50),
  action: z.string().min(1, "请输入操作").max(50),
  module: z.string().max(50).optional(),
  isEnabled: z.boolean(),
});

export type PermissionFormData = z.infer<typeof permissionFormSchema>;
