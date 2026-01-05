import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { CreateDictionarySchema } from "./create-dictionary.dto";

export const BulkCreateDictionarySchema = z.object({
  items: z.array(CreateDictionarySchema).min(1).max(100),
});

export class BulkCreateDictionaryDto extends createZodDto(
  BulkCreateDictionarySchema,
) {}
