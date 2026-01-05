/**
 * 统一的日志工具
 *
 * 特性：
 * - 仅在开发环境输出日志，生产环境静默
 * - 自动添加时间戳前缀（可选）
 * - 支持 log、warn、error 三种级别
 */

interface LoggerOptions {
  timestamp?: boolean;
  prefix?: string;
}

class Logger {
  private options: LoggerOptions;

  constructor(options: LoggerOptions = {}) {
    this.options = {
      timestamp: false,
      prefix: "",
      ...options,
    };
  }

  private formatMessage(...args: unknown[]): unknown[] {
    const parts: unknown[] = [];

    if (this.options.timestamp) {
      parts.push(`[${new Date().toISOString()}]`);
    }

    if (this.options.prefix) {
      parts.push(this.options.prefix);
    }

    return [...parts, ...args];
  }

  /**
   * 开发环境日志（生产环境静默）
   */
  log(...args: unknown[]): void {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log(...this.formatMessage(...args));
    }
  }

  /**
   * 警告日志（生产环境静默）
   */
  warn(...args: unknown[]): void {
    if (import.meta.env.DEV) {
      console.warn(...this.formatMessage(...args));
    }
  }

  /**
   * 错误日志（所有环境输出，用于错误监控）
   */
  error(...args: unknown[]): void {
    console.error(...this.formatMessage(...args));
  }

  /**
   * 创建带前缀的子 logger
   */
  child(prefix: string): Logger {
    return new Logger({
      ...this.options,
      prefix: this.options.prefix ? `${this.options.prefix} ${prefix}` : prefix,
    });
  }
}

// 默认导出
export const logger = new Logger();

// 创建特定模块的 logger
export const createLogger = (prefix: string, options?: LoggerOptions) =>
  new Logger({ ...options, prefix });
