import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { CreateConfigItemSchema } from "./create-config-item.dto";

/**
 * 批量创建/更新配置项的单项
 */
const BatchConfigItemSchema = CreateConfigItemSchema.extend({
  // key 已经在 CreateConfigItemSchema 中定义
});

/**
 * 批量创建/更新配置项请求
 */
export const BatchUpsertConfigSchema = z.object({
  items: z
    .array(BatchConfigItemSchema)
    .min(1, "至少需要一个配置项")
    .max(20, "批量操作最多支持 20 个配置项"),
});

export class BatchUpsertConfigDto extends createZodDto(
  BatchUpsertConfigSchema,
) {}

/**
 * 批量操作单项结果
 */
export interface BatchOperationResult {
  key: string;
  success: boolean;
  error?: string;
  data?: unknown;
}

/**
 * 批量操作响应
 */
export interface BatchOperationResponse {
  total: number;
  successful: number;
  failed: number;
  results: BatchOperationResult[];
}
