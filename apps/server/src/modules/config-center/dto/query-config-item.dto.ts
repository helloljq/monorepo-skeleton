import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { zBooleanFromString } from "../../../common/validation/zod-helpers";

export const QueryConfigItemSchema = z.object({
  key: z.string().trim().optional(),
  isEnabled: zBooleanFromString().optional(),
  page: z.coerce.number().int().min(1).default(1),
  // Canonical param name: pageSize (ADR-API-001 / API design spec).
  // Keep `limit` for backwards compatibility during migration.
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export class QueryConfigItemDto extends createZodDto(QueryConfigItemSchema) {}
