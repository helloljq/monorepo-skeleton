import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1, "页码必须大于等于 1").default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, "每页数量必须大于等于 1")
    .max(100, "每页数量不能超过 100")
    .default(10),
});

export class PaginationDto extends createZodDto(PaginationSchema) {}
