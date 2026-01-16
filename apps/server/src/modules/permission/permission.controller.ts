import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";

import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import {
  CreatePermissionDto,
  QueryPermissionDto,
  UpdatePermissionDto,
} from "./dto";
import { PermissionService } from "./permission.service";

@ApiTags("Permission")
@Controller("permissions")
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  @RequirePermissions("permission:read")
  @ApiOperation({ summary: "权限列表" })
  @ApiQuery({ name: "page", required: false, description: "页码（从1开始）" })
  @ApiQuery({
    name: "pageSize",
    required: false,
    description: "每页数量（1-100）",
  })
  @ApiQuery({ name: "module", required: false, description: "按模块筛选" })
  @ApiQuery({ name: "resource", required: false, description: "按资源筛选" })
  @ApiQuery({ name: "isEnabled", required: false, description: "是否启用" })
  @ApiOkResponse({ description: "返回权限分页列表" })
  findAll(@Query() query: QueryPermissionDto) {
    return this.permissionService.findAll(query);
  }

  @Get("modules")
  @RequirePermissions("permission:read")
  @ApiOperation({ summary: "获取权限模块分组" })
  @ApiOkResponse({ description: "返回权限模块分组列表" })
  findModules() {
    return this.permissionService.findModules();
  }

  @Get(":id")
  @RequirePermissions("permission:read")
  @ApiOperation({ summary: "权限详情" })
  @ApiOkResponse({ description: "返回权限详情（含关联角色）" })
  findOne(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.permissionService.findOne(id);
  }

  @Post()
  @RequirePermissions("permission:create")
  @ApiOperation({ summary: "创建权限" })
  @ApiOkResponse({ description: "返回创建的权限" })
  create(@Body() dto: CreatePermissionDto) {
    return this.permissionService.create(dto);
  }

  @Patch(":id")
  @RequirePermissions("permission:update")
  @ApiOperation({ summary: "更新权限" })
  @ApiOkResponse({ description: "返回更新后的权限" })
  update(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdatePermissionDto,
  ) {
    return this.permissionService.update(id, dto);
  }

  @Delete(":id")
  @RequirePermissions("permission:delete")
  @ApiOperation({ summary: "删除权限" })
  @ApiOkResponse({ description: "返回删除结果" })
  remove(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.permissionService.remove(id);
  }
}
