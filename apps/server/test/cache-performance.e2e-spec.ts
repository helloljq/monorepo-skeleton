/**
 * 配置中心缓存性能测试
 *
 * 测试场景：
 * 1. 缓存命中率
 * 2. 并发读取性能
 * 3. 分布式锁防击穿效果
 * 4. 缓存失效后的恢复时间
 */

import { Test, TestingModule } from "@nestjs/testing";

import { AppModule } from "../src/app.module";
import { ConfigCacheService } from "../src/modules/config-center/services/config-cache.service";
import { ConfigItemService } from "../src/modules/config-center/services/config-item.service";
import { NamespaceService } from "../src/modules/config-center/services/namespace.service";

describe("配置中心缓存性能测试", () => {
  let configItemService: ConfigItemService;
  let cacheService: ConfigCacheService;
  let namespaceService: NamespaceService;

  const TEST_NAMESPACE = "performance_test";
  const TEST_CONFIG_KEY = "perf_config";

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    configItemService = module.get<ConfigItemService>(ConfigItemService);
    cacheService = module.get<ConfigCacheService>(ConfigCacheService);
    namespaceService = module.get<NamespaceService>(NamespaceService);

    // 创建测试命名空间
    try {
      await namespaceService.create({
        name: TEST_NAMESPACE,
        displayName: "性能测试命名空间",
        isEnabled: true,
      });
    } catch {
      // 命名空间可能已存在
    }

    // 创建测试配置
    try {
      await configItemService.create(TEST_NAMESPACE, {
        key: TEST_CONFIG_KEY,
        value: { performance: "test", timestamp: Date.now() },
        valueType: "JSON",
        description: "性能测试配置",
        isEncrypted: false,
        isEnabled: true,
      });
    } catch {
      // 配置可能已存在
    }
  });

  describe("缓存命中率测试", () => {
    it("应该在第一次查询后缓存配置", async () => {
      // 第一次查询（缓存未命中）
      const start1 = Date.now();
      const result1 = await configItemService.findOne(
        TEST_NAMESPACE,
        TEST_CONFIG_KEY,
      );
      const time1 = Date.now() - start1;

      expect(result1).toBeDefined();

      // 第二次查询（缓存命中）
      const start2 = Date.now();
      const result2 = await configItemService.findOne(
        TEST_NAMESPACE,
        TEST_CONFIG_KEY,
      );
      const time2 = Date.now() - start2;

      expect(result2).toBeDefined();
      expect(result2.key).toBe(result1.key);

      // 缓存命中应该明显快于数据库查询
      console.log(`\n性能对比：`);
      console.log(`  首次查询（数据库）: ${time1}ms`);
      console.log(`  缓存命中查询: ${time2}ms`);
      console.log(
        `  性能提升: ${(((time1 - time2) / time1) * 100).toFixed(1)}%`,
      );

      // 缓存查询应该快于数据库查询（容忍度：至少快 20%）
      expect(time2).toBeLessThan(time1 * 0.8);
    });
  });

  describe("并发读取性能测试", () => {
    it("应该支持高并发读取", async () => {
      const concurrency = 100; // 并发数
      const start = Date.now();

      const promises = Array.from({ length: concurrency }, () =>
        configItemService.findOne(TEST_NAMESPACE, TEST_CONFIG_KEY),
      );

      const results = await Promise.all(promises);
      const totalTime = Date.now() - start;
      const avgTime = totalTime / concurrency;

      console.log(`\n并发读取性能：`);
      console.log(`  并发数: ${concurrency}`);
      console.log(`  总耗时: ${totalTime}ms`);
      console.log(`  平均耗时: ${avgTime.toFixed(2)}ms/次`);
      console.log(`  QPS: ${(concurrency / (totalTime / 1000)).toFixed(0)}`);

      expect(results).toHaveLength(concurrency);
      expect(results.every((r) => r.key === TEST_CONFIG_KEY)).toBe(true);

      // 高并发场景下平均响应时间应该小于 100ms
      expect(avgTime).toBeLessThan(100);
    });
  });

  describe("缓存失效与恢复测试", () => {
    it("应该在配置更新后立即失效缓存", async () => {
      const newValue = { updated: true, timestamp: Date.now() };

      // 更新配置（应该失效缓存）
      await configItemService.update(TEST_NAMESPACE, TEST_CONFIG_KEY, {
        value: newValue,
      });

      // 立即读取（应该从数据库重新加载）
      const result = await configItemService.findOne(
        TEST_NAMESPACE,
        TEST_CONFIG_KEY,
      );

      expect(result.value).toEqual(newValue);
    });

    it("应该在缓存失效后快速恢复", async () => {
      // 失效缓存
      await cacheService.invalidate(TEST_NAMESPACE, TEST_CONFIG_KEY);

      const times: number[] = [];

      // 测试恢复速度（10次查询）
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await configItemService.findOne(TEST_NAMESPACE, TEST_CONFIG_KEY);
        times.push(Date.now() - start);
      }

      console.log(`\n缓存恢复性能：`);
      console.log(`  首次查询（重建缓存）: ${times[0]}ms`);
      console.log(
        `  后续查询平均: ${(times.slice(1).reduce((a, b) => a + b, 0) / 9).toFixed(2)}ms`,
      );

      // 后续查询应该显著快于首次查询
      const avgSubsequent = times.slice(1).reduce((a, b) => a + b, 0) / 9;
      expect(avgSubsequent).toBeLessThan(times[0] * 0.5);
    });
  });

  describe("批量操作性能测试", () => {
    it("应该高效处理批量获取请求", async () => {
      // 创建多个配置项
      const keys: string[] = [];
      for (let i = 1; i <= 10; i++) {
        const key = `batch_perf_${i}`;
        keys.push(key);

        try {
          await configItemService.create(TEST_NAMESPACE, {
            key,
            value: { index: i },
            valueType: "JSON",
            description: `批量测试配置 ${i}`,
            isEncrypted: false,
            isEnabled: true,
          });
        } catch {
          // 配置可能已存在
        }
      }

      // 批量获取性能测试
      const start = Date.now();
      const result = await configItemService.batchGet(TEST_NAMESPACE, keys);
      const time = Date.now() - start;

      console.log(`\n批量获取性能：`);
      console.log(`  配置数量: ${keys.length}`);
      console.log(`  总耗时: ${time}ms`);
      console.log(`  平均耗时: ${(time / keys.length).toFixed(2)}ms/个`);

      expect(result).toHaveLength(keys.length);
      expect(time).toBeLessThan(500); // 批量获取10个配置应该在500ms内完成
    });
  });

  describe("压力测试", () => {
    it("应该稳定处理持续高负载", async () => {
      const duration = 5000; // 5秒
      const endTime = Date.now() + duration;
      let count = 0;
      const errors: Error[] = [];

      console.log(`\n压力测试（${duration / 1000}秒）...`);

      const workers = Array.from({ length: 10 }, async () => {
        while (Date.now() < endTime) {
          try {
            await configItemService.findOne(TEST_NAMESPACE, TEST_CONFIG_KEY);
            count++;
          } catch (e) {
            errors.push(e as Error);
          }
        }
      });

      await Promise.all(workers);

      const qps = count / (duration / 1000);

      console.log(`\n压力测试结果：`);
      console.log(`  总请求数: ${count}`);
      console.log(`  错误数: ${errors.length}`);
      console.log(`  QPS: ${qps.toFixed(0)}`);
      console.log(
        `  成功率: ${(((count - errors.length) / count) * 100).toFixed(2)}%`,
      );

      expect(errors.length).toBe(0); // 应该没有错误
      expect(qps).toBeGreaterThan(100); // QPS 应该大于 100
    });
  });

  afterAll(async () => {
    // 清理测试数据
    // 注意：实际环境中可能需要保留数据或使用专门的测试数据库
  });
});
