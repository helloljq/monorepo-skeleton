import { Injectable } from "@nestjs/common";
import Ajv, { type ErrorObject } from "ajv";
import addFormats from "ajv-formats";

import { BusinessException } from "../../../common/errors/business.exception";
import { ApiErrorCode } from "../../../common/errors/error-codes";

/**
 * Schema 错误详情
 */
interface SchemaError {
  path: string;
  message: string;
  keyword: string;
}

/**
 * 配置 Schema 校验服务
 *
 * 使用 Ajv (JSON Schema Draft-07) 对配置值进行格式校验
 *
 * @example
 * ```typescript
 * const schema = {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string' },
 *     age: { type: 'number', minimum: 0 }
 *   },
 *   required: ['name']
 * };
 *
 * // 校验配置值
 * validator.validate({ name: 'John', age: 30 }, schema); // ✓
 * validator.validate({ age: -1 }, schema); // ✗ 抛出异常
 *
 * // 校验 Schema 本身
 * if (!validator.validateSchema(schema)) {
 *   // Schema 定义无效
 * }
 * ```
 */
@Injectable()
export class ConfigSchemaValidatorService {
  private readonly ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true, // 返回所有错误,而不是第一个
      strict: false, // 允许一些宽松的 Schema 写法
    });

    // 添加常用 format 支持 (uri, email, date, time 等)
    addFormats(this.ajv);
  }

  /**
   * 校验配置值是否符合 Schema
   *
   * @param value - 待校验的配置值
   * @param schema - JSON Schema 定义
   * @throws BusinessException 如果校验失败,包含详细的错误信息
   */
  validate(value: unknown, schema: object): void {
    const validate = this.ajv.compile(schema);
    const valid = validate(value);

    if (!valid) {
      const errors = this.formatErrors(validate.errors);

      throw new BusinessException({
        code: ApiErrorCode.CONFIG_SCHEMA_VALIDATION_FAILED,
        message: "配置值不符合 Schema 定义",
        data: { errors },
      });
    }
  }

  /**
   * 校验 Schema 本身是否有效
   *
   * @param schema - JSON Schema 定义
   * @returns true 表示 Schema 有效,false 表示无效
   */
  validateSchema(schema: object): boolean {
    try {
      this.ajv.compile(schema);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 格式化 Ajv 错误信息为更友好的格式
   */
  private formatErrors(
    errors: ErrorObject[] | null | undefined,
  ): SchemaError[] {
    if (!errors) return [];

    return errors.map((e) => ({
      path: e.instancePath || "/", // 错误字段路径
      message: e.message || "Validation failed", // 错误消息
      keyword: e.keyword, // 错误类型 (required, type, minimum 等)
    }));
  }
}
