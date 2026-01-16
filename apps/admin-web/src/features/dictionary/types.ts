import { z } from "zod";

export interface Dictionary {
  /** Public ID (UUID) */
  id: string;
  type: string;
  key: string;
  value: unknown;
  label: string;
  description?: string | null;
  sort: number;
  isEnabled: boolean;
  version?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DictionaryListResponse {
  items: Dictionary[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
  };
}

export const dictionaryFormSchema = z.object({
  type: z
    .string()
    .min(1, "请输入字典类型")
    .max(50, "字典类型最多50个字符")
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "字典类型只能包含小写字母、数字和下划线，且以小写字母开头",
    ),
  key: z
    .string()
    .min(1, "请输入字典键")
    .max(100, "字典键最多100个字符")
    .regex(
      /^[A-Z][A-Z0-9_]*$/,
      "字典键只能包含大写字母、数字和下划线，且以大写字母开头",
    ),
  value: z.string().min(1, "请输入字典值"),
  label: z.string().min(1, "请输入显示标签").max(100, "显示标签最多100个字符"),
  description: z.string().max(500, "描述最多500个字符").optional(),
  sort: z.transform(Number).pipe(z.number().min(0, "排序值不能小于0")),
  isEnabled: z.boolean(),
  version: z.string().max(20, "版本号最多20个字符").optional(),
});

export type DictionaryFormData = z.infer<typeof dictionaryFormSchema>;
