import { z } from "zod";

export interface Role {
  /** Public ID (UUID) */
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  userCount?: number;
  permissionCount?: number;
}

export interface RoleListResponse {
  items: Role[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
  };
}

export const roleFormSchema = z.object({
  code: z
    .string()
    .min(2, "角色编码至少2个字符")
    .max(50, "角色编码最多50个字符")
    .regex(/^[A-Z][A-Z0-9_]*$/, "大写字母开头，只能包含大写字母、数字和下划线"),
  name: z.string().min(1, "请输入角色名称").max(100),
  description: z.string().max(500, "描述最多500个字符").optional(),
  isEnabled: z.boolean(),
});

export type RoleFormData = z.infer<typeof roleFormSchema>;
