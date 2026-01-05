import { createZodDto } from "nestjs-zod";
import { z } from "zod";

/**
 * 字典元数据（轻量级，用于前端判断是否需要重新拉取完整数据）
 */
export const DictionaryMetaSchema = z.object({
  key: z.string(),
  version: z.string().nullable(),
  configHash: z.string().nullable(),
});

export class DictionaryMetaDto extends createZodDto(DictionaryMetaSchema) {}
