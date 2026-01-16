import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";

import { MaxLimit } from "../../../common/decorators/max-limit.decorator";
import { RequirePermissions } from "../../auth/decorators/permissions.decorator";
import { Public } from "../../auth/decorators/public.decorator";
import {
  BatchUpsertConfigDto,
  CreateConfigItemDto,
  QueryConfigItemDto,
  RollbackConfigDto,
  UpdateConfigItemDto,
} from "../dto";
import { ConfigItemService } from "../services/config-item.service";

/**
 * 配置项管理接口
 */
@ApiTags("Config Center - Config Items")
@Controller("config")
export class ConfigItemController {
  constructor(private readonly configItemService: ConfigItemService) {}

  /**
   * 获取公开配置项（匿名访问）
   */
  @Get("public/:namespace/:key")
  @Public()
  @ApiOperation({ summary: "获取公开配置项（匿名访问）" })
  @ApiParam({ name: "namespace", description: "命名空间名称" })
  @ApiParam({ name: "key", description: "配置项 key" })
  @ApiOkResponse({ description: "查询成功" })
  async getPublicConfig(
    @Param("namespace") namespace: string,
    @Param("key") key: string,
  ) {
    return this.configItemService.findPublicByKey(namespace, key);
  }

  /**
   * 批量创建/更新配置项
   */
  @Post(":namespace/batch")
  @RequirePermissions("config:item:create", "config:item:update")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "批量创建/更新配置项（最多 20 个）" })
  @ApiParam({ name: "namespace", description: "命名空间名称" })
  @ApiOkResponse({ description: "批量操作完成" })
  async batchUpsert(
    @Param("namespace") namespace: string,
    @Body() dto: BatchUpsertConfigDto,
  ) {
    return this.configItemService.batchUpsert(namespace, dto);
  }

  /**
   * 创建配置项
   */
  @Post(":namespace")
  @RequirePermissions("config:item:create")
  @ApiOperation({ summary: "创建配置项" })
  @ApiParam({ name: "namespace", description: "命名空间名称" })
  @ApiCreatedResponse({ description: "创建成功" })
  async create(
    @Param("namespace") namespace: string,
    @Body() dto: CreateConfigItemDto,
  ) {
    return this.configItemService.create(namespace, dto);
  }

  /**
   * 获取命名空间下所有配置项
   * 配置项总量有限，允许更大的 limit
   */
  @Get(":namespace")
  @RequirePermissions("config:item:read")
  @MaxLimit(1000)
  @ApiOperation({ summary: "获取命名空间下所有配置项（分页）" })
  @ApiParam({ name: "namespace", description: "命名空间名称" })
  @ApiQuery({
    name: "key",
    required: false,
    description: "配置项 key（模糊查询）",
  })
  @ApiQuery({ name: "page", required: false, description: "页码（从1开始）" })
  @ApiQuery({
    name: "pageSize",
    required: false,
    description: "每页数量（默认1-100，此接口允许最大1000）",
  })
  @ApiQuery({ name: "isEnabled", required: false, description: "是否启用" })
  @ApiOkResponse({ description: "返回配置项分页列表" })
  async findAll(
    @Param("namespace") namespace: string,
    @Query() query: QueryConfigItemDto,
  ) {
    return this.configItemService.findAll(namespace, query);
  }

  /**
   * 批量获取配置项
   */
  @Get(":namespace/batch")
  @RequirePermissions("config:item:read")
  @ApiOperation({ summary: "批量获取配置项（最多 50 个）" })
  @ApiParam({ name: "namespace", description: "命名空间名称" })
  @ApiQuery({
    name: "keys",
    required: true,
    description: "配置项 key 列表（逗号分隔，如：key1,key2,key3）",
  })
  @ApiOkResponse({ description: "返回配置项列表" })
  async batchGet(
    @Param("namespace") namespace: string,
    @Query("keys") keys: string,
  ) {
    // 解析逗号分隔的 keys
    const keyList = keys ? keys.split(",").map((k) => k.trim()) : [];
    return this.configItemService.batchGet(namespace, keyList);
  }

  /**
   * 获取单个配置项
   */
  @Get(":namespace/:key")
  @RequirePermissions("config:item:read")
  @ApiOperation({ summary: "获取单个配置项" })
  @ApiParam({ name: "namespace", description: "命名空间名称" })
  @ApiParam({ name: "key", description: "配置项 key" })
  @ApiOkResponse({ description: "查询成功" })
  async findOne(
    @Param("namespace") namespace: string,
    @Param("key") key: string,
  ) {
    return this.configItemService.findOne(namespace, key);
  }

  /**
   * 获取配置项元数据（轻量级）
   */
  @Get(":namespace/:key/meta")
  @RequirePermissions("config:item:read")
  @ApiOperation({ summary: "获取配置项元数据（用于缓存校验）" })
  @ApiParam({ name: "namespace", description: "命名空间名称" })
  @ApiParam({ name: "key", description: "配置项 key" })
  @ApiOkResponse({ description: "查询成功" })
  async getMeta(
    @Param("namespace") namespace: string,
    @Param("key") key: string,
  ) {
    return this.configItemService.getMeta(namespace, key);
  }

  /**
   * 更新配置项
   */
  @Put(":namespace/:key")
  @RequirePermissions("config:item:update")
  @ApiOperation({ summary: "更新配置项" })
  @ApiParam({ name: "namespace", description: "命名空间名称" })
  @ApiParam({ name: "key", description: "配置项 key" })
  @ApiOkResponse({ description: "更新成功" })
  async update(
    @Param("namespace") namespace: string,
    @Param("key") key: string,
    @Body() dto: UpdateConfigItemDto,
  ) {
    return this.configItemService.update(namespace, key, dto);
  }

  /**
   * 删除配置项
   */
  @Delete(":namespace/:key")
  @RequirePermissions("config:item:delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "删除配置项（软删除）" })
  @ApiParam({ name: "namespace", description: "命名空间名称" })
  @ApiParam({ name: "key", description: "配置项 key" })
  @ApiOkResponse({ description: "删除成功" })
  async remove(
    @Param("namespace") namespace: string,
    @Param("key") key: string,
  ) {
    await this.configItemService.remove(namespace, key);
  }

  /**
   * 获取配置项变更历史
   */
  @Get(":namespace/:key/history")
  @RequirePermissions("config:item:read")
  @ApiOperation({ summary: "获取配置项变更历史（分页）" })
  @ApiParam({ name: "namespace", description: "命名空间名称" })
  @ApiParam({ name: "key", description: "配置项 key" })
  @ApiQuery({ name: "page", required: false, description: "页码（从1开始）" })
  @ApiQuery({
    name: "pageSize",
    required: false,
    description: "每页数量（1-100）",
  })
  @ApiOkResponse({ description: "返回历史记录分页列表" })
  async getHistory(
    @Param("namespace") namespace: string,
    @Param("key") key: string,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number,
    @Query("limit") limit?: number,
  ) {
    return this.configItemService.getHistory(
      namespace,
      key,
      page ?? 1,
      pageSize ?? limit ?? 10,
    );
  }

  /**
   * 回滚配置到指定版本
   */
  @Post(":namespace/:key/rollback/:version")
  @RequirePermissions("config:item:rollback")
  @ApiOperation({ summary: "回滚配置到指定版本" })
  @ApiParam({ name: "namespace", description: "命名空间名称" })
  @ApiParam({ name: "key", description: "配置项 key" })
  @ApiParam({ name: "version", description: "目标版本号" })
  @ApiOkResponse({ description: "回滚成功" })
  async rollback(
    @Param("namespace") namespace: string,
    @Param("key") key: string,
    @Param("version") version: string,
    @Body() dto: RollbackConfigDto,
  ) {
    const targetVersion = parseInt(version, 10);
    return this.configItemService.rollback(
      namespace,
      key,
      targetVersion,
      dto.changeNote,
    );
  }
}
