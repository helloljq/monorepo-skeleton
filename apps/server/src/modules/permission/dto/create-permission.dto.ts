import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const CreatePermissionSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(100)
    .regex(
      /^[a-z][a-z0-9]*:[a-z][a-z0-9-]*$/,
      "Code must follow pattern: resource:action (e.g., user:create, order:read-self)",
    )
    .trim(),
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
  resource: z.string().min(1).max(50).trim(),
  action: z.string().min(1).max(50).trim(),
  module: z.string().max(50).optional(),
});

export class CreatePermissionDto extends createZodDto(CreatePermissionSchema) {}
