import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const RollbackConfigSchema = z.object({
  changeNote: z
    .string()
    .max(500, "变更说明最长500个字符")
    .optional()
    .transform((val) => (val ? val.trim() : undefined)),
});

export class RollbackConfigDto extends createZodDto(RollbackConfigSchema) {}
