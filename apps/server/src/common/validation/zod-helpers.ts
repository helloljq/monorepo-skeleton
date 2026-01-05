import { z } from "zod";

/**
 * 常用 Zod 字符串规范化/校验工具
 *
 * 原则：
 * - 对"标识类字符串"（email/username/deviceId/手机号/邀请码等）默认 trim，避免用户复制粘贴带空格导致不匹配
 * - 对"展示类字符串"（昵称/备注）是否 trim 由业务决定
 * - XSS 防护不建议用"全字段过滤"，应按字段语义制定规则（详见开发规范）
 */

export const zNonEmptyTrimmedString = () =>
  z.string().trim().min(1, "不能为空");

export const zTrimmedEmail = () => z.string().trim().email("邮箱格式不正确");

/**
 * 用于大多数"纯文本"字段的最小防护（不允许出现 < > 以降低被当作 HTML 的风险）
 *
 * ⚠️ XSS 防护限制说明：
 * - 此方法仅提供基础保护，过滤 < 和 > 字符
 * - 不防护其他 XSS 向量（如 javascript:、data:、事件处理器等）
 * - 不适用于富文本内容，富文本必须使用专门的 sanitize 库（如 DOMPurify）
 *
 * 适用场景：
 * - 用户名、备注、简短描述等纯文本字段
 * - 不会被解析为 HTML 的场景
 *
 * 不适用场景：
 * - 富文本编辑器内容（应使用 DOMPurify 或类似库）
 * - URL 字段（应使用专门的 URL 验证）
 * - JSON/代码片段（应根据使用场景单独处理）
 *
 * 输出端防护：
 * - 前端渲染时仍应使用框架的自动转义（React JSX、Vue 模板等）
 * - 避免使用 dangerouslySetInnerHTML 或 v-html
 */
export const zPlainText = () =>
  z
    .string()
    .trim()
    .refine((s) => !/[<>]/.test(s), {
      message: "不允许包含 < 和 > 字符",
    });

/**
 * 从 URL 查询参数字符串中解析布尔值
 *
 * 支持的格式：
 * - "true", "1" -> true
 * - "false", "0" -> false
 * - undefined/null -> undefined (optional 时)
 *
 * 使用场景：
 * - Query 参数中的 isEnabled/isActive 等布尔标志
 *
 * 注意：
 * - 不能使用 z.coerce.boolean()，因为它会将所有非空字符串转为 true
 */
export const zBooleanFromString = () =>
  z
    .union([z.string(), z.boolean()])
    .transform((val) => {
      if (typeof val === "boolean") return val;
      const lower = val.toLowerCase();
      if (lower === "true" || lower === "1") return true;
      if (lower === "false" || lower === "0") return false;
      throw new Error(`Invalid boolean string: ${val}`);
    })
    .pipe(z.boolean());

/**
 * 可选的 ISO 8601 日期时间字符串，转换为 Date 对象
 *
 * 使用场景：
 * - Query 参数中的 startTime/endTime 等时间范围筛选
 * - 日期格式必须为 ISO 8601（如 2024-12-01T00:00:00Z）
 *
 * 返回类型：Date | undefined
 */
export const zOptionalDateString = () =>
  z
    .string()
    .datetime({ message: "日期格式无效，请使用 ISO 8601 格式" })
    .transform((val) => new Date(val))
    .optional();
