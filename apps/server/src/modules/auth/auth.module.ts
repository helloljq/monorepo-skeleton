import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { IdentityModule } from "../identity/identity.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PermissionsGuard } from "./guards/permissions.guard";
import { RolesGuard } from "./guards/roles.guard";
import { PermissionCacheService } from "./services/permission-cache.service";
import { SmsModule } from "./services/sms.module";
import { JwtStrategy } from "./strategies/jwt.strategy";

@Module({
  imports: [
    PassportModule,
    ConfigModule,
    JwtModule.register({}), // We provide options in Service signAsync
    IdentityModule,
    SmsModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    PermissionCacheService,
    RolesGuard,
    PermissionsGuard,
  ],
  exports: [
    AuthService,
    PermissionCacheService,
    RolesGuard,
    PermissionsGuard,
    SmsModule,
  ],
})
export class AuthModule {}
