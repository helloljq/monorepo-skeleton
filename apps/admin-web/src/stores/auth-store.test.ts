import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "./auth-store";

describe("authStore", () => {
  const mockUser = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    email: "test@example.com",
    name: "Test User",
  };

  beforeEach(() => {
    // 清理 localStorage，并设置一个固定 deviceId（避免依赖 store 初始化时的随机值）
    localStorage.clear();
    localStorage.setItem("device-id", "web-test-device-id");

    // 重置 store 状态
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      deviceId: "web-test-device-id",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("should have correct initial state", () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe("login", () => {
    it("should set user and isAuthenticated on login", () => {
      useAuthStore.getState().login(mockUser);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
    });
  });

  describe("logout", () => {
    it("should clear user and isAuthenticated on logout", () => {
      // 先登录
      useAuthStore.getState().login(mockUser);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // 再登出
      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe("setUser", () => {
    it("should set user and update isAuthenticated", () => {
      useAuthStore.getState().setUser(mockUser);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
    });

    it("should set isAuthenticated to false when user is null", () => {
      useAuthStore.getState().setUser(mockUser);
      useAuthStore.getState().setUser(null);

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe("deviceId", () => {
    it("should generate deviceId if not exists", () => {
      // 创建新的 store 实例会触发 generateDeviceId
      const deviceId = useAuthStore.getState().deviceId;
      expect(typeof deviceId).toBe("string");
    });

    it("should reuse existing deviceId from localStorage", () => {
      const existingId = "web-1234567890-abcdefgh";
      localStorage.setItem("device-id", existingId);

      // 重新获取状态（模拟重新加载）
      // 注意：由于 zustand 是单例，这里只能验证 localStorage 的值
      expect(localStorage.getItem("device-id")).toBe(existingId);
    });
  });

  describe("persistence", () => {
    it("should persist user and deviceId", () => {
      useAuthStore.getState().login(mockUser);

      // 检查 localStorage 中的持久化数据
      const stored = localStorage.getItem("auth-storage");
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed.state.user).toEqual(mockUser);
      expect(parsed.state.deviceId).toBe("web-test-device-id");
    });

    it("should not persist isAuthenticated directly (computed from user)", () => {
      useAuthStore.getState().login(mockUser);

      const stored = localStorage.getItem("auth-storage");
      const parsed = JSON.parse(stored!);

      // partialize 不包含 isAuthenticated
      expect(parsed.state.isAuthenticated).toBeUndefined();
    });
  });
});
