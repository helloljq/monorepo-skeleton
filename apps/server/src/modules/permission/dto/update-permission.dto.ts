import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const UpdatePermissionSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).optional().nullable(),
  module: z.string().max(50).optional().nullable(),
  isEnabled: z.boolean().optional(),
});

export class UpdatePermissionDto extends createZodDto(UpdatePermissionSchema) {}
