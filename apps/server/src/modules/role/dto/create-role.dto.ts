import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const CreateRoleSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(50)
    .regex(
      /^[A-Z][A-Z0-9_]*$/,
      "Code must be uppercase letters, numbers, and underscores, starting with a letter",
    )
    .trim(),
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
});

export class CreateRoleDto extends createZodDto(CreateRoleSchema) {}
