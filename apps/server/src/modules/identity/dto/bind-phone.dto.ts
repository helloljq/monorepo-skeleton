import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const BindPhoneSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, "手机号格式不正确"),
  code: z.string().length(6, "验证码必须为 6 位数字"),
});

export class BindPhoneDto extends createZodDto(BindPhoneSchema) {}
