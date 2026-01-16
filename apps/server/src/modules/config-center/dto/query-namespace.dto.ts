import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const BaseQuerySchema = z.object({
  isEnabled: z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined || val === "") return undefined;
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined;
    }),
});

export const QueryNamespaceSchema = BaseQuerySchema.merge(
  z.object({
    page: z.coerce.number().int().min(1).default(1),
    // Canonical param name: pageSize (ADR-API-001 / API design spec).
    // Keep `limit` for backwards compatibility during migration.
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
);

export class QueryNamespaceDto extends createZodDto(QueryNamespaceSchema) {}
