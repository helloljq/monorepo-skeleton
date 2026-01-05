import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/stores/authStore";

import {
  customFetch,
  getRefreshStats,
  resetRefreshStats,
} from "./custom-fetch";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock window.location
const mockLocation = { href: "" };
Object.defineProperty(window, "location", {
  value: mockLocation,
  writable: true,
});

describe("customFetch", () => {
  const mockTokens = {
    accessToken: "test-access-token",
    refreshToken: "test-refresh-token",
    accessExpiresInSeconds: 3600,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.href = "";
    localStorage.clear();
    resetRefreshStats();

    // 设置初始认证状态
    useAuthStore.setState({
      user: { id: 1, email: "test@example.com" },
      tokens: mockTokens,
      deviceId: "test-device-id",
      isAuthenticated: true,
    });
  });

  afterEach(() => {
    useAuthStore.getState().logout();
  });

  describe("successful requests", () => {
    it("should make a GET request with auth header", async () => {
      const responseData = { id: 1, name: "Test" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ code: 0, message: "success", data: responseData }),
      });

      const result = await customFetch({
        url: "/api/v1/users/1",
        method: "GET",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/users/1",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer test-access-token",
            "Content-Type": "application/json",
          }),
        }),
      );
      expect(result).toEqual(responseData);
    });

    it("should make a POST request with body", async () => {
      const requestData = { name: "New User" };
      const responseData = { id: 1, name: "New User" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ code: 0, message: "success", data: responseData }),
      });

      const result = await customFetch({
        url: "/api/v1/users",
        method: "POST",
        data: requestData,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/users",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(requestData),
        }),
      );
      expect(result).toEqual(responseData);
    });

    it("should handle query params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ code: 0, data: [] }),
      });

      await customFetch({
        url: "/api/v1/users",
        method: "GET",
        params: { page: 1, limit: 10 },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/users?page=1&limit=10",
        expect.any(Object),
      );
    });

    it("should skip null and undefined params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ code: 0, data: [] }),
      });

      await customFetch({
        url: "/api/v1/users",
        method: "GET",
        params: { page: 1, name: undefined, status: null },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/users?page=1",
        expect.any(Object),
      );
    });

    it("should handle 204 No Content response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const result = await customFetch({
        url: "/api/v1/users/1",
        method: "DELETE",
      });

      expect(result).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("should throw ApiError for non-2xx responses", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: () => Promise.resolve({ code: 400, message: "Invalid input" }),
      });

      await expect(
        customFetch({ url: "/api/v1/users", method: "POST", data: {} }),
      ).rejects.toThrow("Invalid input");
    });

    it("should handle json parse error gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: () => Promise.reject(new Error("Invalid JSON")),
      });

      await expect(
        customFetch({ url: "/api/v1/users", method: "GET" }),
      ).rejects.toThrow("Internal Server Error");
    });
  });

  describe("refresh stats", () => {
    it("should track refresh statistics", () => {
      resetRefreshStats();
      const stats = getRefreshStats();

      expect(stats.totalAttempts).toBe(0);
      expect(stats.successCount).toBe(0);
      expect(stats.failureCount).toBe(0);
      expect(stats.avgDuration).toBe(0);
      expect(stats.successRate).toBe(0);
    });
  });

  describe("without authentication", () => {
    it("should make request without auth header when no token", async () => {
      useAuthStore.getState().logout();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ code: 0, data: { public: true } }),
      });

      await customFetch({ url: "/api/v1/public", method: "GET" });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/public",
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.any(String),
          }),
        }),
      );
    });
  });

  describe("401 handling and token refresh", () => {
    it("should refresh token and retry request on 401", async () => {
      const newTokens = {
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
        accessExpiresInSeconds: 3600,
      };

      // First request returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ code: 401, message: "Unauthorized" }),
      });

      // Refresh token request succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ code: 0, data: newTokens }),
      });

      // Retry request succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ code: 0, data: { id: 1, name: "Test" } }),
      });

      const result = await customFetch({
        url: "/api/v1/users/1",
        method: "GET",
      });

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ id: 1, name: "Test" });

      // Verify stats
      const stats = getRefreshStats();
      expect(stats.successCount).toBe(1);
    });

    it("should redirect to login when refresh fails with 401", async () => {
      // First request returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ code: 401, message: "Unauthorized" }),
      });

      // Refresh token request also returns 401 (expired)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({ code: 401, message: "Refresh token expired" }),
      });

      await expect(
        customFetch({ url: "/api/v1/users/1", method: "GET" }),
      ).rejects.toThrow();

      expect(mockLocation.href).toBe("/login");

      // Verify stats
      const stats = getRefreshStats();
      expect(stats.failureCount).toBe(1);
    });

    it("should redirect to login when no refresh token available", async () => {
      // Clear tokens but keep deviceId
      useAuthStore.setState({
        user: { id: 1, email: "test@example.com" },
        tokens: null,
        deviceId: "test-device-id",
        isAuthenticated: false,
      });

      // Request returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ code: 401, message: "Unauthorized" }),
      });

      await expect(
        customFetch({ url: "/api/v1/users/1", method: "GET" }),
      ).rejects.toThrow();

      expect(mockLocation.href).toBe("/login");
    });

    it("should not refresh token for /auth/refresh endpoint itself", async () => {
      // Refresh endpoint returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({ code: 401, message: "Invalid refresh token" }),
      });

      await expect(
        customFetch({ url: "/api/v1/auth/refresh", method: "POST", data: {} }),
      ).rejects.toThrow();

      // Should only make 1 request (no retry)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("refresh stats calculation", () => {
    it("should calculate average duration and success rate correctly", async () => {
      resetRefreshStats();

      // Simulate successful refresh
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ code: 401 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              code: 0,
              data: {
                accessToken: "new-token",
                refreshToken: "new-refresh",
                accessExpiresInSeconds: 3600,
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ code: 0, data: {} }),
        });

      await customFetch({ url: "/api/v1/test", method: "GET" });

      const stats = getRefreshStats();
      expect(stats.totalAttempts).toBe(1);
      expect(stats.successCount).toBe(1);
      expect(stats.successRate).toBe(100);
      expect(stats.avgDuration).toBeGreaterThan(0);
    });
  });
});
