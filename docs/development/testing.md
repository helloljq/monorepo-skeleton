# 测试规范

> 本文档是测试规范的**唯一事实来源**。

## 强制级别说明

| 标记 | 含义 | PR 影响 |
|------|------|---------|
| 🔴 | 阻塞 - 违反即拒绝 PR | 必须修复 |
| 🟡 | 建议修复 - 允许例外但需说明理由 | 应当修复 |
| 🟢 | 建议 - 经验性最佳实践 | 可选 |

---

## 测试策略

### 测试策略（单人项目精简版）

```
   /-------\
  /  Unit   \     单元测试（覆盖核心业务逻辑）
 /___________\
```

> **注意**: 作为单人独立开发项目，我们采用精简的测试策略，专注于核心业务逻辑的单元测试，
> 不维护 E2E 测试以降低维护成本。

### 覆盖率要求

| 指标 | 要求 | 级别 | CI 行为 |
|------|------|------|---------|
| 行覆盖率 (lines) | ≥ 70% | 🔴 | 低于阈值 PR 阻塞 |
| 分支覆盖率 (branches) | ≥ 60% | 🟡 | 低于阈值警告 |
| 函数覆盖率 (functions) | ≥ 70% | 🟡 | 低于阈值警告 |

### CI 覆盖率配置

```yaml
# .github/workflows/ci.yml
- name: Run tests with coverage
  run: pnpm test:cov

- name: Check coverage thresholds
  run: |
    # 使用 vitest/jest 内置阈值检查
    # 配置在 vitest.config.ts / jest.config.js
```

```typescript
// vitest.config.ts 示例
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 70,
        branches: 60,
        functions: 70,
        statements: 70,
      },
    },
  },
});
```

---

## 后端测试 (NestJS)

### 单元测试 🔴

位置：`src/**/*.spec.ts`

```typescript
// user.service.spec.ts
describe('UserService', () => {
  let service: UserService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
      ],
    }).compile();

    service = module.get(UserService);
    prisma = module.get(PrismaService);
  });

  // 🔴 必须覆盖正常路径
  describe('findById', () => {
    it('应返回用户信息', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };
      prisma.soft.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById(1);

      expect(result).toEqual(mockUser);
    });

    // 🔴 必须覆盖至少一个异常分支
    it('用户不存在时应抛出 NotFoundException', async () => {
      prisma.soft.user.findUnique.mockResolvedValue(null);

      await expect(service.findById(999))
        .rejects
        .toThrow(NotFoundException);
    });
  });
});
```

### 强制覆盖要求 🔴

| 要求 | 说明 |
|------|------|
| 🔴 Service 单测必须覆盖正常路径 | happy path |
| 🔴 Service 单测必须覆盖至少一个异常分支 | 参数非法/资源不存在等 |
| 🔴 禁止直连真实数据库/Redis | 必须 mock |

### 命令

```bash
pnpm --filter server test           # 单元测试
pnpm --filter server test:watch     # 监听模式
pnpm --filter server test:cov       # 覆盖率报告
```

---

## 前端测试 (React)

### 单元测试 (Vitest) 🟡

位置：`src/**/*.test.ts`

```typescript
describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null });
  });

  it('login 应设置用户和 token', () => {
    const { login } = useAuthStore.getState();
    login({ id: '1', name: 'Test' }, 'token123');

    const state = useAuthStore.getState();
    expect(state.user).toEqual({ id: '1', name: 'Test' });
    expect(state.token).toBe('token123');
  });
});
```

### 命令

```bash
pnpm --filter admin-web test              # 单元测试
pnpm --filter admin-web test:coverage     # 覆盖率
```

---

## 测试最佳实践 🟢

### 命名规范

```typescript
// 🟢 好：描述行为和预期结果
it('用户不存在时应抛出 NotFoundException', ...)
it('正确凭据应返回 tokens', ...)

// 🔴 差：描述不清
it('test findById', ...)
it('should work', ...)
```

### AAA 模式 🟢

```typescript
it('应计算订单总价', () => {
  // Arrange（准备）
  const items = [{ price: 100, quantity: 2 }];

  // Act（执行）
  const total = calculateTotal(items);

  // Assert（断言）
  expect(total).toBe(200);
});
```

### Mock 原则 🔴

| 规则 | 级别 |
|------|------|
| 🔴 外部依赖必须 Mock | 数据库、Redis、第三方 API |
| 🟢 业务逻辑不要 Mock | 测试真实行为 |
| 🟢 使用工厂函数生成测试数据 | 提高可维护性 |

---

## CI 集成

### PR 合并要求 🔴

| 要求 | 级别 |
|------|------|
| 🔴 所有测试通过 | CI 强制 |
| 🔴 覆盖率不低于阈值 | CI 强制（lines ≥ 70%） |
| 🟡 新功能有对应测试 | Review 检查 |
| 🟡 不降低整体覆盖率 | Review 检查 |
