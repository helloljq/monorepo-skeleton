import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const QueryUserSchema = z.object({
  // Public ID (ADR-ID-001): UUID string
  id: z.string().uuid().optional(),
  email: z.string().trim().optional(),
  name: z.string().trim().optional(),
  // Role public id (UUID)
  roleId: z.string().uuid().optional(),
  status: z.enum(["ACTIVE", "DISABLED", "PENDING"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  // Canonical param name: pageSize (ADR-API-001 / API design spec).
  // Keep `limit` for backwards compatibility during migration.
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export class QueryUserDto extends createZodDto(QueryUserSchema) {}
