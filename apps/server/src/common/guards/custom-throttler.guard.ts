import { ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { ThrottlerModuleOptions } from "@nestjs/throttler";
import {
  getOptionsToken,
  getStorageToken,
  ThrottlerGuard,
  ThrottlerStorage,
} from "@nestjs/throttler";

import { AppConfigService } from "../../config/app-config.service";

/**
 * 自定义限流 Guard，开发环境跳过限流检查
 * @see 通过 APP_GUARD 注入，不需要在 module providers 中注册
 */
/* eslint-disable @darraghor/nestjs-typed/injectable-should-be-provided */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  constructor(
    @Inject(getOptionsToken()) options: ThrottlerModuleOptions,
    @Inject(getStorageToken()) storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly appConfig: AppConfigService,
  ) {
    super(options, storageService, reflector);
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    // 开发环境跳过限流
    if (!this.appConfig.isProduction) {
      return true;
    }

    return super.canActivate(context);
  }
}
