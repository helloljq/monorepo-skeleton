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
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";

import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { DictionaryService } from "./dictionary.service";
import {
  BulkCreateDictionaryDto,
  CreateDictionaryDto,
  GetByTypeDto,
  QueryDictionaryDto,
  UpdateDictionaryDto,
} from "./dto";

@ApiTags("Dictionary")
@Controller("dictionaries")
export class DictionaryController {
  constructor(private readonly dictionaryService: DictionaryService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: "字典列表（分页）",
    description: "获取字典分页列表，支持按类型和启用状态过滤",
  })
  @ApiQuery({
    name: "page",
    required: false,
    description: "页码（从1开始）",
    example: 1,
  })
  @ApiQuery({
    name: "pageSize",
    required: false,
    description: "每页数量（1-100）",
    example: 10,
  })
  @ApiQuery({
    name: "type",
    required: false,
    description: "字典类型",
    example: "gender",
  })
  @ApiQuery({
    name: "isEnabled",
    required: false,
    description: "是否启用",
    example: true,
  })
  @ApiOkResponse({ description: "返回字典分页列表" })
  findAll(@Query() query: QueryDictionaryDto) {
    return this.dictionaryService.findAll(query);
  }

  @Get("type/:type/meta")
  @Public()
  @ApiOperation({
    summary: "获取字典元数据（轻量级）✨",
    description:
      "返回指定类型字典的元数据（仅 key + version + configHash），数据量极小（~500B）。\n\n" +
      "**使用场景**: 前端缓存优化，先查询 meta 判断 configHash 是否变化，仅在变化时才拉取完整数据。\n\n" +
      "**性能优势**: 配置未变化时，节省 99% 带宽（50KB → 500B）。\n\n" +
      "**推荐流程**:\n" +
      "1. 调用此接口获取 configHash\n" +
      "2. 对比本地缓存的 hash\n" +
      "3. 仅在 hash 变化时调用 `/type/:type` 拉取完整数据\n\n" +
      "详见: [Dictionary API 前端使用指南](../../../docs/features/dictionary-api-guide.md)",
  })
  @ApiParam({
    name: "type",
    description: "字典类型（如 app_config, gender, order_status）",
    example: "app_config",
  })
  @ApiQuery({
    name: "isEnabled",
    required: false,
    description: "是否只获取启用的字典（推荐 true）",
    example: true,
  })
  @ApiOkResponse({
    description: "返回字典元数据列表",
    schema: {
      example: {
        code: "SUCCESS",
        message: "ok",
        data: [
          {
            key: "IOS_V2_0",
            version: "2.0.0",
            configHash: "5d41402abc4b2a76b9719d911017c592",
          },
          {
            key: "ANDROID_V2_0",
            version: "2.0.1",
            configHash: "abc123def456789...",
          },
        ],
      },
    },
  })
  getMetaByType(@Param("type") type: string, @Query() query: GetByTypeDto) {
    return this.dictionaryService.getMetaByType({ ...query, type });
  }

  @Get("type/:type")
  @Public()
  @ApiOperation({
    summary: "按类型获取字典列表（带缓存）⭐",
    description:
      "根据字典类型获取完整字典列表，**服务端 Redis 缓存 1 小时**。前端最常用接口。\n\n" +
      "**适用场景**:\n" +
      "- 简单枚举（性别、状态等，数据量 < 10KB）\n" +
      "- App 配置、功能开关等（配合 `/type/:type/meta` 做缓存优化）\n\n" +
      "**返回字段说明**:\n" +
      "- `value`: JSON 格式，可以是 object / string / number / boolean / null\n" +
      "- `configHash`: 自动生成的 MD5 hash，用于判断数据是否变化\n" +
      "- `version`: 可选的版本号（如 1.0.0）",
  })
  @ApiParam({
    name: "type",
    description: "字典类型（如 gender, order_status, app_config）",
    example: "gender",
  })
  @ApiQuery({
    name: "isEnabled",
    required: false,
    description: "是否只获取启用的字典（业务逻辑建议传 true）",
    example: true,
  })
  @ApiOkResponse({
    description: "返回指定类型的字典列表",
    schema: {
      example: {
        code: "SUCCESS",
        message: "ok",
        data: [
          {
            id: "550e8400-e29b-41d4-a716-446655440000",
            type: "gender",
            key: "MALE",
            value: 1,
            label: "男",
            description: null,
            sort: 1,
            isEnabled: true,
            version: null,
            configHash: "5d41402abc4b2a76b9719d911017c592",
            createdAt: "2024-12-24T07:00:00.000Z",
            updatedAt: "2024-12-24T07:00:00.000Z",
          },
          {
            id: "550e8400-e29b-41d4-a716-446655440001",
            type: "gender",
            key: "FEMALE",
            value: 2,
            label: "女",
            description: null,
            sort: 2,
            isEnabled: true,
            version: null,
            configHash: "098f6bcd4621d373cade4e832627b4f6",
            createdAt: "2024-12-24T07:00:00.000Z",
            updatedAt: "2024-12-24T07:00:00.000Z",
          },
        ],
      },
    },
  })
  findByType(@Param("type") type: string, @Query() query: GetByTypeDto) {
    return this.dictionaryService.findByType({ ...query, type });
  }

  @Get(":id")
  @Public()
  @ApiOperation({ summary: "字典详情" })
  @ApiParam({
    name: "id",
    description: "字典 ID（Public ID，UUID）",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @ApiOkResponse({ description: "返回字典详情" })
  findOne(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.dictionaryService.findOne(id);
  }

  @Post()
  @RequirePermissions("dictionary:create")
  @ApiOperation({
    summary: "创建字典",
    description:
      "创建新的字典项。type+key 必须唯一（允许重新创建已软删除的记录）。",
  })
  @ApiOkResponse({ description: "返回创建的字典" })
  create(@Body() dto: CreateDictionaryDto) {
    return this.dictionaryService.create(dto);
  }

  @Post("bulk")
  @RequirePermissions("dictionary:create")
  @ApiOperation({
    summary: "批量创建字典（数据初始化）",
    description:
      "批量创建字典项（1-100条），使用事务保证原子性。用于初始化字典数据。",
  })
  @ApiOkResponse({ description: "返回批量创建结果，包含创建数量和数据" })
  bulkCreate(@Body() dto: BulkCreateDictionaryDto) {
    return this.dictionaryService.bulkCreate(dto.items);
  }

  @Patch(":id")
  @RequirePermissions("dictionary:update")
  @ApiOperation({
    summary: "更新字典",
    description: "更新字典项的值、标签、描述等。type 和 key 不可修改。",
  })
  @ApiParam({
    name: "id",
    description: "字典 ID（Public ID，UUID）",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @ApiOkResponse({ description: "返回更新后的字典" })
  update(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() dto: UpdateDictionaryDto,
  ) {
    return this.dictionaryService.update(id, dto);
  }

  @Delete(":id")
  @RequirePermissions("dictionary:delete")
  @ApiOperation({
    summary: "删除字典（软删除）",
    description: "软删除字典项，支持后续恢复。会自动失效相关缓存。",
  })
  @ApiParam({
    name: "id",
    description: "字典 ID（Public ID，UUID）",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @ApiOkResponse({ description: "返回删除成功消息" })
  remove(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.dictionaryService.remove(id);
  }
}
