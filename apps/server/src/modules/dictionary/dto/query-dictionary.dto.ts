import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { zBooleanFromString } from "../../../common/validation/zod-helpers";

export const QueryDictionarySchema = z.object({
  type: z.string().optional(),
  isEnabled: zBooleanFromString().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export class QueryDictionaryDto extends createZodDto(QueryDictionarySchema) {}
