import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { zBooleanFromString } from "../../../common/validation/zod-helpers";

export const QueryConfigItemSchema = z.object({
  key: z.string().trim().optional(),
  isEnabled: zBooleanFromString().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export class QueryConfigItemDto extends createZodDto(QueryConfigItemSchema) {}
