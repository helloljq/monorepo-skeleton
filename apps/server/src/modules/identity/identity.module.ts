import { Module } from "@nestjs/common";

import { SmsModule } from "../auth/services/sms.module";
import { IdentityController } from "./identity.controller";
import { IdentityService } from "./identity.service";

@Module({
  imports: [SmsModule],
  controllers: [IdentityController],
  providers: [IdentityService],
  exports: [IdentityService],
})
export class IdentityModule {}
