import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
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
import { AssignRoleDto, AssignRolesDto, QueryUserDto } from "./dto";
import { UserService } from "./user.service";

@ApiTags("User")
@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @RequirePermissions("user:read")
  @ApiOperation({ summary: "用户列表" })
  @ApiQuery({ name: "id", required: false, description: "用户ID（精确查询）" })
  @ApiQuery({
    name: "email",
    required: false,
    description: "邮箱（模糊查询）",
  })
  @ApiQuery({ name: "name", required: false, description: "姓名（模糊查询）" })
  @ApiQuery({
    name: "roleId",
    required: false,
    description: "角色ID（精确查询）",
  })
  @ApiQuery({
    name: "status",
    required: false,
    description: "用户状态（ACTIVE|DISABLED|PENDING）",
  })
  @ApiQuery({ name: "page", required: false, description: "页码（从1开始）" })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "每页数量（1-1000）",
  })
  @ApiOkResponse({ description: "返回用户分页列表" })
  findAll(@Query() query: QueryUserDto) {
    return this.userService.findAll(query);
  }

  @Get(":id")
  @RequirePermissions("user:read")
  @ApiOperation({ summary: "获取用户详情" })
  @ApiOkResponse({ description: "返回用户详情（含角色信息）" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.userService.findOne(id);
  }

  @Get(":id/roles")
  @RequirePermissions("user:read")
  @ApiOperation({ summary: "获取用户角色列表" })
  @ApiOkResponse({ description: "返回用户的角色列表" })
  findUserRoles(@Param("id", ParseIntPipe) id: number) {
    return this.userService.findUserRoles(id);
  }

  @Post(":id/roles")
  @RequirePermissions("user:assign-role")
  @ApiOperation({ summary: "为用户分配角色" })
  @ApiOkResponse({ description: "角色分配成功" })
  assignRole(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AssignRoleDto,
  ) {
    return this.userService.assignRole(id, dto);
  }

  @Post(":id/roles/batch")
  @RequirePermissions("user:assign-role")
  @ApiOperation({ summary: "批量为用户分配角色（替换模式）" })
  @ApiOkResponse({ description: "角色分配成功" })
  assignRoles(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AssignRolesDto,
  ) {
    return this.userService.assignRoles(id, dto.roleIds);
  }

  @Delete(":id/roles/:roleId")
  @RequirePermissions("user:assign-role")
  @ApiOperation({ summary: "移除用户的角色" })
  @ApiOkResponse({ description: "角色移除成功" })
  removeRole(
    @Param("id", ParseIntPipe) id: number,
    @Param("roleId", ParseIntPipe) roleId: number,
  ) {
    return this.userService.removeRole(id, roleId);
  }
}
