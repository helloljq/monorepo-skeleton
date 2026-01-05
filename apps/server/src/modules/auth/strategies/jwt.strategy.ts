import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";

import { AppConfigService } from "../../../config/app-config.service";
import { JwtPayload, RequestUser } from "../dto/jwt-payload.schema";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: AppConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: Request) => {
          const token = request?.cookies?.["access_token"] as unknown;
          return typeof token === "string" ? token : null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: config.auth.accessSecret,
    });
  }

  validate(payload: JwtPayload): RequestUser {
    return {
      userId: payload.sub,
      email: payload.email,
      roles: payload.roles ?? [],
    };
  }
}
