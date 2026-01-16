import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const AssignPermissionsSchema = z.object({
  permissionIds: z
    .array(z.string().uuid())
    .min(1)
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "Permission IDs must be unique",
    }),
});

export class AssignPermissionsDto extends createZodDto(
  AssignPermissionsSchema,
) {}

export const RemovePermissionSchema = z.object({
  permissionId: z.string().uuid(),
});

export class RemovePermissionDto extends createZodDto(RemovePermissionSchema) {}
