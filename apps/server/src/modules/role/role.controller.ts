import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
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
  AssignPermissionsDto,
  CreateRoleDto,
  QueryRoleDto,
  UpdateRoleDto,
} from "./dto";
import { RoleService } from "./role.service";

@ApiTags("Role")
@Controller("roles")
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @RequirePermissions("role:read")
  @ApiOperation({ summary: "角色列表" })
  @ApiQuery({ name: "page", required: false, description: "页码（从1开始）" })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "每页数量（1-100）",
  })
  @ApiQuery({ name: "isEnabled", required: false, description: "是否启用" })
  @ApiOkResponse({ description: "返回角色分页列表" })
  findAll(@Query() query: QueryRoleDto) {
    return this.roleService.findAll(query);
  }

  @Get(":id")
  @RequirePermissions("role:read")
  @ApiOperation({ summary: "角色详情" })
  @ApiOkResponse({ description: "返回角色详情（含权限列表）" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.roleService.findOne(id);
  }

  @Get(":id/permissions")
  @RequirePermissions("role:read")
  @ApiOperation({ summary: "获取角色权限列表" })
  @ApiOkResponse({ description: "返回该角色的权限列表" })
  findRolePermissions(@Param("id", ParseIntPipe) id: number) {
    return this.roleService.findRolePermissions(id);
  }

  @Post()
  @RequirePermissions("role:create")
  @ApiOperation({ summary: "创建角色" })
  @ApiOkResponse({ description: "返回创建的角色" })
  create(@Body() dto: CreateRoleDto) {
    return this.roleService.create(dto);
  }

  @Patch(":id")
  @RequirePermissions("role:update")
  @ApiOperation({ summary: "更新角色" })
  @ApiOkResponse({ description: "返回更新后的角色" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateRoleDto) {
    return this.roleService.update(id, dto);
  }

  @Delete(":id")
  @RequirePermissions("role:delete")
  @ApiOperation({ summary: "删除角色" })
  @ApiOkResponse({ description: "返回删除结果" })
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.roleService.remove(id);
  }

  @Post(":id/permissions")
  @RequirePermissions("role:assign-permission")
  @ApiOperation({ summary: "为角色分配权限（替换模式）" })
  @ApiOkResponse({ description: "权限分配成功" })
  assignPermissions(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AssignPermissionsDto,
  ) {
    return this.roleService.assignPermissions(id, dto.permissionIds);
  }

  @Delete(":id/permissions/:permissionId")
  @RequirePermissions("role:assign-permission")
  @ApiOperation({ summary: "移除角色的权限" })
  @ApiOkResponse({ description: "权限移除成功" })
  removePermission(
    @Param("id", ParseIntPipe) id: number,
    @Param("permissionId", ParseIntPipe) permissionId: number,
  ) {
    return this.roleService.removePermission(id, permissionId);
  }
}
