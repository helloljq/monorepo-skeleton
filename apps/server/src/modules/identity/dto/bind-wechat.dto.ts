import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const BindWechatSchema = z.object({
  code: z.string().min(1, "授权码不能为空"),
  provider: z.enum(["WECHAT_MINI", "WECHAT_MP", "WECHAT_OPEN"]),
});

export class BindWechatDto extends createZodDto(BindWechatSchema) {}
