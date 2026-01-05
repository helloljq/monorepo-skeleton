import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const BindEmailSchema = z.object({
  email: z.string().email("邮箱格式不正确").toLowerCase().trim(),
  password: z
    .string()
    .min(8, "密码长度至少为 8 个字符")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "密码必须包含至少一个小写字母、一个大写字母和一个数字",
    ),
  code: z.string().length(6, "验证码必须为 6 位数字"),
});

export class BindEmailDto extends createZodDto(BindEmailSchema) {}
