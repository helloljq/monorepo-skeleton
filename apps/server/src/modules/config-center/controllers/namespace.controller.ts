import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import { MaxLimit } from "../../../common/decorators/max-limit.decorator";
import { RequirePermissions } from "../../auth/decorators/permissions.decorator";
import {
  CreateNamespaceDto,
  QueryNamespaceDto,
  UpdateNamespaceDto,
} from "../dto";
import { NamespaceService } from "../services/namespace.service";

/**
 * 配置命名空间管理接口
 */
@ApiTags("Config Center - Namespaces")
@Controller("config/namespaces")
export class NamespaceController {
  constructor(private readonly namespaceService: NamespaceService) {}

  /**
   * 创建命名空间
   */
  @Post()
  @RequirePermissions("config:namespace:create")
  @ApiOperation({ summary: "创建配置命名空间" })
  @ApiCreatedResponse({ description: "创建成功" })
  async create(@Body() dto: CreateNamespaceDto) {
    return this.namespaceService.create(dto);
  }

  /**
   * 查询命名空间列表
   * 配置命名空间总量有限，允许更大的 limit
   */
  @Get()
  @RequirePermissions("config:namespace:read")
  @MaxLimit(1000)
  @ApiOperation({ summary: "查询配置命名空间列表" })
  @ApiOkResponse({ description: "查询成功" })
  async findAll(@Query() query: QueryNamespaceDto) {
    return this.namespaceService.findAll(query);
  }

  /**
   * 获取命名空间详情
   */
  @Get(":name")
  @RequirePermissions("config:namespace:read")
  @ApiOperation({ summary: "获取配置命名空间详情" })
  @ApiParam({ name: "name", description: "命名空间名称" })
  @ApiOkResponse({ description: "查询成功" })
  async findOne(@Param("name") name: string) {
    return this.namespaceService.findByName(name);
  }

  /**
   * 更新命名空间
   */
  @Patch(":name")
  @RequirePermissions("config:namespace:update")
  @ApiOperation({ summary: "更新配置命名空间" })
  @ApiParam({ name: "name", description: "命名空间名称" })
  @ApiOkResponse({ description: "更新成功" })
  async update(@Param("name") name: string, @Body() dto: UpdateNamespaceDto) {
    return this.namespaceService.update(name, dto);
  }

  /**
   * 删除命名空间
   */
  @Delete(":name")
  @RequirePermissions("config:namespace:delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "删除配置命名空间（软删除）" })
  @ApiParam({ name: "name", description: "命名空间名称" })
  @ApiOkResponse({ description: "删除成功" })
  async remove(@Param("name") name: string) {
    await this.namespaceService.remove(name);
  }
}
