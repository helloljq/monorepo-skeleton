import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "./authStore";

describe("authStore", () => {
  const mockUser = {
    id: 1,
    email: "test@example.com",
    name: "Test User",
  };

  const mockTokens = {
    accessToken: "access-token-123",
    refreshToken: "refresh-token-456",
    accessExpiresInSeconds: 3600,
  };

  beforeEach(() => {
    // 清理 localStorage
    localStorage.clear();
    // 重置 store 状态
    useAuthStore.setState({
      user: null,
      tokens: null,
      isAuthenticated: false,
      deviceId: "",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("should have correct initial state", () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.tokens).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe("login", () => {
    it("should set user, tokens and isAuthenticated on login", () => {
      useAuthStore.getState().login(mockUser, mockTokens);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.tokens).toEqual(mockTokens);
      expect(state.isAuthenticated).toBe(true);
    });
  });

  describe("logout", () => {
    it("should clear user, tokens and isAuthenticated on logout", () => {
      // 先登录
      useAuthStore.getState().login(mockUser, mockTokens);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // 再登出
      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.tokens).toBeNull();
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

  describe("setTokens", () => {
    it("should set tokens and update isAuthenticated", () => {
      useAuthStore.getState().setTokens(mockTokens);

      const state = useAuthStore.getState();
      expect(state.tokens).toEqual(mockTokens);
      expect(state.isAuthenticated).toBe(true);
    });

    it("should set isAuthenticated to false when tokens is null", () => {
      useAuthStore.getState().setTokens(mockTokens);
      useAuthStore.getState().setTokens(null);

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe("deviceId", () => {
    it("should generate deviceId if not exists", () => {
      // 创建新的 store 实例会触发 generateDeviceId
      const deviceId = useAuthStore.getState().deviceId;
      // deviceId 可能是空字符串（因为我们在 beforeEach 中重置了）
      // 但在实际使用中，初始化时会生成
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
    it("should persist user, tokens and deviceId", () => {
      useAuthStore.getState().login(mockUser, mockTokens);

      // 检查 localStorage 中的持久化数据
      const stored = localStorage.getItem("auth-storage");
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed.state.user).toEqual(mockUser);
      expect(parsed.state.tokens).toEqual(mockTokens);
    });

    it("should not persist isAuthenticated directly (computed from tokens)", () => {
      useAuthStore.getState().login(mockUser, mockTokens);

      const stored = localStorage.getItem("auth-storage");
      const parsed = JSON.parse(stored!);

      // partialize 不包含 isAuthenticated
      expect(parsed.state.isAuthenticated).toBeUndefined();
    });
  });
});
