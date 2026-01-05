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
    limit: z.coerce.number().int().min(1).max(100).default(10),
  }),
);

export class QueryNamespaceDto extends createZodDto(QueryNamespaceSchema) {}
