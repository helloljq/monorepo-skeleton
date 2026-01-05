import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Request,
} from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request as ExpressRequest } from "express";

import { SmsService } from "../auth/services/sms.service";
import {
  BindEmailDto,
  BindPhoneDto,
  IdentityItemDto,
  IdentityListResponseDto,
  UnbindResponseDto,
} from "./dto";
import { IdentityService } from "./identity.service";

@ApiTags("Identity")
@Controller("identity")
export class IdentityController {
  constructor(
    private readonly identityService: IdentityService,
    private readonly smsService: SmsService,
  ) {}

  @Get("list")
  @ApiOperation({ summary: "获取当前用户身份列表" })
  @ApiOkResponse({ description: "身份列表", type: IdentityListResponseDto })
  async listIdentities(
    @Request() req: ExpressRequest & { user: { userId: number } },
  ): Promise<IdentityListResponseDto> {
    const identities = await this.identityService.getUserIdentities(
      req.user.userId,
    );

    const maskedIdentities: IdentityItemDto[] = identities.map((identity) => ({
      id: identity.id,
      provider: identity.provider,
      providerId: this.identityService.maskProviderId(
        identity.provider,
        identity.providerId,
      ),
      verified: identity.verified,
      createdAt: identity.createdAt,
    }));

    return { identities: maskedIdentities };
  }

  @Post("bind/email")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "绑定邮箱" })
  @ApiOkResponse({ description: "绑定成功" })
  async bindEmail(
    @Request() req: ExpressRequest & { user: { userId: number } },
    @Body() dto: BindEmailDto,
  ) {
    // 验证邮箱验证码（复用手机验证码服务，key 格式为 email:xxx）
    await this.smsService.verifyCode(dto.email, dto.code);

    await this.identityService.bindEmail(
      req.user.userId,
      dto.email,
      dto.password,
    );

    return { message: "Email bound successfully" };
  }

  @Post("bind/phone")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "绑定手机号" })
  @ApiOkResponse({ description: "绑定成功" })
  async bindPhone(
    @Request() req: ExpressRequest & { user: { userId: number } },
    @Body() dto: BindPhoneDto,
  ) {
    // 验证手机验证码
    await this.smsService.verifyCode(dto.phone, dto.code);

    await this.identityService.bindPhone(req.user.userId, dto.phone);

    return { message: "Phone bound successfully" };
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "解绑身份" })
  @ApiOkResponse({ description: "解绑成功", type: UnbindResponseDto })
  async unbindIdentity(
    @Request() req: ExpressRequest & { user: { userId: number } },
    @Param("id", ParseIntPipe) identityId: number,
  ): Promise<UnbindResponseDto> {
    await this.identityService.unbindIdentity(req.user.userId, identityId);

    return { message: "Identity unbound successfully" };
  }
}
