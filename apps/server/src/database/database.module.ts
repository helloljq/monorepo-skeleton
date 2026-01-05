import { Global, Module } from "@nestjs/common";

import { AppConfigModule } from "../config/app-config.module";
import { PrismaService } from "./prisma/prisma.service";

@Global()
@Module({
  imports: [AppConfigModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
