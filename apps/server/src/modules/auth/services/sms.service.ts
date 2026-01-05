import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import Redis from "ioredis";

import { BusinessException } from "../../../common/errors/business.exception";
import { ApiErrorCode } from "../../../common/errors/error-codes";
import { REDIS_CLIENT } from "../../../common/redis/redis.module";

/**
 * 短信验证码服务
 *
 * 当前为测试模式：验证码打印到日志，不实际发送短信
 * 生产环境需对接阿里云/腾讯云等短信服务
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  private readonly CODE_PREFIX = "sms:code:";
  private readonly RATE_PREFIX = "sms:rate:";
  private readonly CODE_TTL = 300; // 5 分钟
  private readonly RATE_LIMIT_PER_MINUTE = 1;
  private readonly RATE_LIMIT_PER_HOUR = 10;

  constructor(@Inject(REDIS_CLIENT) private redis: Redis) {}

  /**
   * 发送验证码
   */
  async sendCode(phone: string): Promise<void> {
    // 1. 频率限制检查
    await this.checkRateLimit(phone);

    // 2. 生成 6 位验证码
    const code = this.generateCode();

    // 3. 存储验证码
    await this.redis.setex(`${this.CODE_PREFIX}${phone}`, this.CODE_TTL, code);

    // 4. 更新频率计数
    await this.updateRateLimit(phone);

    // 5. 发送短信（测试模式：打印到日志）
    this.logger.warn(
      { phone, code },
      "[sms] Verification code (TEST MODE - DO NOT USE IN PRODUCTION)",
    );

    // TODO: 生产环境对接真实短信服务
    // await this.sendSmsViaProvider(phone, code);
  }

  /**
   * 验证验证码
   */
  async verifyCode(phone: string, code: string): Promise<boolean> {
    const key = `${this.CODE_PREFIX}${phone}`;
    const storedCode = await this.redis.get(key);

    if (!storedCode) {
      throw new BusinessException({
        code: ApiErrorCode.AUTH_PHONE_CODE_EXPIRED,
        message: "Verification code expired",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    if (storedCode !== code) {
      throw new BusinessException({
        code: ApiErrorCode.AUTH_PHONE_CODE_INVALID,
        message: "Invalid verification code",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    // 验证成功后删除验证码（一次性使用）
    await this.redis.del(key);

    return true;
  }

  /**
   * 检查频率限制
   */
  private async checkRateLimit(phone: string): Promise<void> {
    const minuteKey = `${this.RATE_PREFIX}minute:${phone}`;
    const hourKey = `${this.RATE_PREFIX}hour:${phone}`;

    // 检查分钟级限制
    const minuteCount = await this.redis.get(minuteKey);
    if (
      minuteCount &&
      parseInt(minuteCount, 10) >= this.RATE_LIMIT_PER_MINUTE
    ) {
      throw new BusinessException({
        code: ApiErrorCode.AUTH_PHONE_RATE_LIMITED,
        message: "Too many requests, please try again later",
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    }

    // 检查小时级限制
    const hourCount = await this.redis.get(hourKey);
    if (hourCount && parseInt(hourCount, 10) >= this.RATE_LIMIT_PER_HOUR) {
      throw new BusinessException({
        code: ApiErrorCode.AUTH_PHONE_RATE_LIMITED,
        message: "Too many requests, please try again in an hour",
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    }
  }

  /**
   * 更新频率计数
   */
  private async updateRateLimit(phone: string): Promise<void> {
    const minuteKey = `${this.RATE_PREFIX}minute:${phone}`;
    const hourKey = `${this.RATE_PREFIX}hour:${phone}`;

    // 分钟级计数（60秒过期）
    const minutePipeline = this.redis.pipeline();
    minutePipeline.incr(minuteKey);
    minutePipeline.expire(minuteKey, 60);
    await minutePipeline.exec();

    // 小时级计数（3600秒过期）
    const hourPipeline = this.redis.pipeline();
    hourPipeline.incr(hourKey);
    hourPipeline.expire(hourKey, 3600);
    await hourPipeline.exec();
  }

  /**
   * 生成 6 位数字验证码
   */
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
