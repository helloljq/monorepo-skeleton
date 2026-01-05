import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { AppConfigModule } from "../../config/app-config.module";
import { WsGateway } from "./ws.gateway";

@Module({
  imports: [
    AppConfigModule,
    JwtModule.register({}), // Options provided at verify time
  ],
  providers: [WsGateway],
})
export class WsModule {}
