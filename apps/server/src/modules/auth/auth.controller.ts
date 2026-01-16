import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request as ExpressRequest, Response } from "express";

import { BusinessException } from "../../common/errors/business.exception";
import { ApiErrorCode } from "../../common/errors/error-codes";
import { parseDurationToSeconds } from "../../common/utils/time.util";
import { AppConfigService } from "../../config/app-config.service";
import { AuthService } from "./auth.service";
import { Public } from "./decorators/public.decorator";
import {
  LoginDto,
  LogoutDto,
  LogoutResponseDto,
  PhoneLoginDto,
  RefreshTokenDto,
  RegisterDto,
  RegisterResponseDto,
  SendSmsCodeDto,
  TokenResponseDto,
  WebLoginResponseDto,
  WebRefreshDto,
} from "./dto/auth.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

/** Cookie 名称常量 */
const COOKIE_ACCESS_TOKEN = "access_token";
const COOKIE_REFRESH_TOKEN = "refresh_token";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: AppConfigService,
  ) {}

  /**
   * 设置认证 Cookie
   */
  private setAuthCookies(
    res: Response,
    tokens: {
      accessToken: string;
      refreshToken: string;
      accessExpiresInSeconds: number;
    },
  ): void {
    const isProduction = this.config.isProduction;
    const refreshTtlSeconds = parseDurationToSeconds(
      this.config.auth.refreshTtl,
    );

    res.cookie(COOKIE_ACCESS_TOKEN, tokens.accessToken, {
      maxAge: tokens.accessExpiresInSeconds * 1000,
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
    });

    res.cookie(COOKIE_REFRESH_TOKEN, tokens.refreshToken, {
      maxAge: refreshTtlSeconds * 1000,
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
    });
  }

  /**
   * 清除认证 Cookie
   */
  private clearAuthCookies(res: Response): void {
    const isProduction = this.config.isProduction;

    res.clearCookie(COOKIE_ACCESS_TOKEN, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
    });

    res.clearCookie(COOKIE_REFRESH_TOKEN, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
    });
  }

  @Public()
  @Post("register")
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 registrations per minute per IP
  @ApiOperation({ summary: "注册" })
  @ApiOkResponse({ description: "注册成功", type: RegisterResponseDto })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post("login")
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 login attempts per minute per IP
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "登录" })
  @ApiOkResponse({ description: "登录成功", type: TokenResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(dto);
    this.setAuthCookies(res, tokens);
    return tokens;
  }

  @Public()
  @Post("web/login")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Web 登录（HttpOnly Cookie）" })
  @ApiOkResponse({
    description: "登录成功（不返回 Token）",
    type: WebLoginResponseDto,
  })
  async webLogin(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.authService.loginWeb(dto);
    this.setAuthCookies(res, tokens);
    return user;
  }

  @Public()
  @Post("refresh")
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 refresh attempts per minute per IP
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "刷新 Token" })
  @ApiOkResponse({ description: "刷新成功", type: TokenResponseDto })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.refresh(dto);
    this.setAuthCookies(res, tokens);
    return tokens;
  }

  @Public()
  @Post("web/refresh")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Web 刷新（HttpOnly Cookie）" })
  @ApiOkResponse({ description: "刷新成功（不返回 Token）" })
  async webRefresh(
    @Request() req: ExpressRequest,
    @Body() dto: WebRefreshDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      (req.cookies?.[COOKIE_REFRESH_TOKEN] as unknown) ?? null;
    if (typeof refreshToken !== "string" || refreshToken.length === 0) {
      throw new BusinessException({
        code: ApiErrorCode.UNAUTHORIZED,
        message: "Unauthorized",
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    const tokens = await this.authService.refresh({
      refreshToken,
      deviceId: dto.deviceId,
    });
    this.setAuthCookies(res, tokens);
    return {};
  }

  @Public()
  @Post("sms/send")
  @Throttle({ default: { limit: 1, ttl: 60000 } }) // 1 SMS per minute per IP
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "发送短信验证码" })
  @ApiOkResponse({ description: "验证码已发送" })
  sendSmsCode(@Body() dto: SendSmsCodeDto) {
    return this.authService.sendSmsCode(dto.phone);
  }

  @Public()
  @Post("login/phone")
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute per IP
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "手机号验证码登录" })
  @ApiOkResponse({ description: "登录成功", type: TokenResponseDto })
  async loginWithPhone(
    @Body() dto: PhoneLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.loginWithPhone(dto);
    this.setAuthCookies(res, tokens);
    return tokens;
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "登出（按 deviceId）" })
  @ApiOkResponse({ description: "登出成功", type: LogoutResponseDto })
  async logout(
    @Request() req: ExpressRequest & { user: { userId: number } },
    @Body() dto: LogoutDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.logout(req.user.userId, dto.deviceId);
    this.clearAuthCookies(res);
    return result;
  }
}
