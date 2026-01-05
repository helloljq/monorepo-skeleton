import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { AppService } from "./app.service";
import { Public } from "./modules/auth/decorators/public.decorator";

@ApiTags("App")
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: "Hello World" })
  @ApiOkResponse({ description: "Hello World" })
  getHello(): string {
    return this.appService.getHello();
  }
}
