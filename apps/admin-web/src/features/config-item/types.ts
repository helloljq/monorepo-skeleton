import { z } from "zod";

export type ValueType = "JSON" | "STRING" | "NUMBER" | "BOOLEAN";

export interface ConfigItem {
  id: number;
  namespace: string;
  key: string;
  value: unknown;
  valueType: ValueType;
  description?: string | null;
  isEncrypted: boolean;
  isEnabled: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigItemListResponse {
  data: ConfigItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ConfigItemHistory {
  id: number;
  configItemId: number;
  value: unknown;
  valueType: ValueType;
  version: number;
  operatorId: number;
  operatorName: string;
  createdAt: string;
}

export interface ConfigItemHistoryResponse {
  data: ConfigItemHistory[];
}

// 配置项表单 Schema
export const configItemFormSchema = z.object({
  key: z
    .string()
    .min(1, "请输入配置键")
    .max(100, "配置键最多100个字符")
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "配置键只能包含小写字母、数字和下划线，且以小写字母开头",
    ),
  valueType: z.enum(["JSON", "STRING", "NUMBER", "BOOLEAN"], {
    message: "请选择值类型",
  }),
  value: z.string().min(1, "请输入配置值"),
  description: z.string().max(500, "描述最多500个字符").optional(),
  isEncrypted: z.boolean(),
  isEnabled: z.boolean(),
});

export type ConfigItemFormData = z.infer<typeof configItemFormSchema>;

// 回滚配置 Schema
export const rollbackConfigSchema = z.object({
  changeNote: z
    .string()
    .min(1, "请输入回滚原因")
    .max(500, "回滚原因最多500个字符"),
});

export type RollbackConfigData = z.infer<typeof rollbackConfigSchema>;
