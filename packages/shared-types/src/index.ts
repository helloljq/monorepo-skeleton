/**
 * 共享类型定义
 *
 * ## 类型分类
 *
 * 1. **响应格式类型** (ApiResponse, PaginationMeta)
 *    - 定义统一的 API 响应结构
 *    - Orval 不生成这些类型，需要手动维护
 *    - 与后端 TransformInterceptor 输出格式保持一致
 *
 * 2. **枚举类型** (UserStatus, RoleType, IdentityProvider 等)
 *    - 与后端 Prisma schema 中的枚举保持一致
 *    - 修改时需同步更新：prisma/schema.prisma
 *
 * ## 不应放在此处的类型
 *
 * - DTO 类型：由 Orval 从 Swagger 自动生成
 * - 应用特定类型：放在各应用的 types/ 目录
 */

// ============================================
// API 响应格式（与后端 TransformInterceptor 一致）
// ============================================

// API 响应类型（ADR-API-001）
export type ApiResponse<T = unknown> = {
  code: string;
  data: T;
  message: string;
};

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
};

export type PaginatedData<T> = {
  items: T[];
  pagination: Pagination;
};

export type PaginatedResponse<T> = ApiResponse<PaginatedData<T>>;

// 分页请求参数
export type PaginationParams = {
  page?: number;
  pageSize?: number;
};

// ============================================
// 枚举类型（与 prisma/schema.prisma 保持一致）
// ============================================

// 用户状态
export type UserStatus = "ACTIVE" | "DISABLED" | "PENDING";

// 角色类型
export type RoleType = "SYSTEM" | "CUSTOM";

// 身份提供者
export type IdentityProvider =
  | "EMAIL"
  | "PHONE"
  | "WECHAT_OPEN"
  | "WECHAT_UNION"
  | "WECHAT_MINI"
  | "WECHAT_MP";

// 配置值类型
export type ConfigValueType = "JSON" | "STRING" | "NUMBER" | "BOOLEAN";

// 配置变更类型
export type ConfigChangeType = "CREATE" | "UPDATE" | "DELETE" | "ROLLBACK";
