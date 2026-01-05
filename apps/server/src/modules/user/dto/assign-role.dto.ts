import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const AssignRoleSchema = z.object({
  roleId: z.number().int().positive(),
  expiresAt: z
    .string()
    .datetime({ message: "expiresAt must be a valid ISO 8601 datetime string" })
    .optional(),
});

export class AssignRoleDto extends createZodDto(AssignRoleSchema) {}

export const AssignRolesSchema = z.object({
  roleIds: z
    .array(z.number().int().positive())
    .min(1)
    .max(50)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "Role IDs must be unique",
    }),
});

export class AssignRolesDto extends createZodDto(AssignRolesSchema) {}
