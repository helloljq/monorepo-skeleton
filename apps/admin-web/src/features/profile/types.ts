import { z } from "zod";

// 绑定邮箱表单验证
export const bindEmailSchema = z.object({
  email: z.string().min(1, "请输入邮箱").email("请输入有效的邮箱地址"),
  password: z
    .string()
    .min(8, "密码至少8位")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "密码需包含大小写字母和数字"),
  code: z.string().min(6, "验证码为6位").max(6, "验证码为6位"),
});

export type BindEmailFormData = z.infer<typeof bindEmailSchema>;

// 绑定手机号表单验证
export const bindPhoneSchema = z.object({
  phone: z
    .string()
    .min(1, "请输入手机号")
    .regex(/^1[3-9]\d{9}$/, "请输入有效的手机号"),
  code: z.string().min(6, "验证码为6位").max(6, "验证码为6位"),
});

export type BindPhoneFormData = z.infer<typeof bindPhoneSchema>;

// 身份提供商显示名称映射
export const providerDisplayNames: Record<string, string> = {
  EMAIL: "邮箱",
  PHONE: "手机号",
  WECHAT_OPEN: "微信开放平台",
  WECHAT_UNION: "微信联合登录",
  WECHAT_MINI: "微信小程序",
  WECHAT_MP: "微信公众号",
};

// 获取身份提供商显示名称
export function getProviderDisplayName(provider: string): string {
  return providerDisplayNames[provider] || provider;
}
