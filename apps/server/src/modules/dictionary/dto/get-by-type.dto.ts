import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { zBooleanFromString } from "../../../common/validation/zod-helpers";

export const GetByTypeSchema = z.object({
  isEnabled: zBooleanFromString().optional().default(true),
});

export class GetByTypeDto extends createZodDto(GetByTypeSchema) {}
