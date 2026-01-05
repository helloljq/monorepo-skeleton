import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const QueryUserSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  email: z.string().trim().optional(),
  name: z.string().trim().optional(),
  roleId: z.coerce.number().int().positive().optional(),
  status: z.enum(["ACTIVE", "DISABLED", "PENDING"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export class QueryUserDto extends createZodDto(QueryUserSchema) {}
