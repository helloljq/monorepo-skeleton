import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const UpdateRoleSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).optional().nullable(),
  isEnabled: z.boolean().optional(),
});

export class UpdateRoleDto extends createZodDto(UpdateRoleSchema) {}
