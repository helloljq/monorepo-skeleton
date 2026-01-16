import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/stores/auth-store";

// Mock env (avoid relying on Vite env injection in tests)
vi.mock("@/config/env", () => ({
  API_BASE_URL: "http://api.example.com",
}));

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
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.href = "";
    localStorage.clear();
    resetRefreshStats();

    // 设置初始认证状态
    useAuthStore.setState({
      user: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        email: "test@example.com",
      },
      deviceId: "test-device-id",
      isAuthenticated: true,
    });
  });

  afterEach(() => {
    useAuthStore.getState().logout();
  });

  describe("successful requests", () => {
    it("should make a GET request with cookies (credentials: include)", async () => {
      const responseData = { id: 1, name: "Test" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            code: "SUCCESS",
            message: "ok",
            data: responseData,
          }),
      });

      const result = await customFetch({
        url: "/v1/users/1",
        method: "GET",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://api.example.com/v1/users/1",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-Trace-Id": expect.any(String),
          }),
          credentials: "include",
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
          Promise.resolve({
            code: "SUCCESS",
            message: "ok",
            data: responseData,
          }),
      });

      const result = await customFetch({
        url: "/v1/users",
        method: "POST",
        data: requestData,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://api.example.com/v1/users",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(requestData),
          credentials: "include",
        }),
      );
      expect(result).toEqual(responseData);
    });

    it("should handle query params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ code: "SUCCESS", message: "ok", data: [] }),
      });

      await customFetch({
        url: "/v1/users",
        method: "GET",
        params: { page: 1, limit: 10 },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://api.example.com/v1/users?page=1&limit=10",
        expect.any(Object),
      );
    });

    it("should skip null and undefined params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ code: "SUCCESS", message: "ok", data: [] }),
      });

      await customFetch({
        url: "/v1/users",
        method: "GET",
        params: { page: 1, name: undefined, status: null },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://api.example.com/v1/users?page=1",
        expect.any(Object),
      );
    });

    it("should handle 204 No Content response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const result = await customFetch({
        url: "/v1/users/1",
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
        json: () =>
          Promise.resolve({
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            data: null,
          }),
      });

      await expect(
        customFetch({ url: "/v1/users", method: "POST", data: {} }),
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
        customFetch({ url: "/v1/users", method: "GET" }),
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
    it("should make request without Authorization header when logged out", async () => {
      useAuthStore.getState().logout();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            code: "SUCCESS",
            message: "ok",
            data: { public: true },
          }),
      });

      await customFetch({ url: "/v1/public", method: "GET" });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://api.example.com/v1/public",
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.any(String),
          }),
          credentials: "include",
        }),
      );
    });
  });

  describe("401 handling and cookie refresh", () => {
    it("should refresh cookie session and retry request on 401", async () => {
      // First request returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            code: "UNAUTHORIZED",
            message: "Unauthorized",
            data: null,
          }),
      });

      // Refresh cookie session request succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      // Retry request succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            code: "SUCCESS",
            message: "ok",
            data: { id: 1, name: "Test" },
          }),
      });

      const result = await customFetch({
        url: "/v1/users/1",
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
        json: () =>
          Promise.resolve({
            code: "UNAUTHORIZED",
            message: "Unauthorized",
            data: null,
          }),
      });

      // Refresh token request also returns 401 (expired)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            code: "UNAUTHORIZED",
            message: "Refresh token expired",
            data: null,
          }),
      });

      await expect(
        customFetch({ url: "/v1/users/1", method: "GET" }),
      ).rejects.toThrow();

      expect(mockLocation.href).toBe("/login");

      // Verify stats
      const stats = getRefreshStats();
      expect(stats.failureCount).toBe(1);
    });

    it("should not refresh session for /v1/auth/web/refresh endpoint itself", async () => {
      // web/refresh endpoint returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({ code: "UNAUTHORIZED", message: "Unauthorized" }),
      });

      await expect(
        customFetch({ url: "/v1/auth/web/refresh", method: "POST", data: {} }),
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
          json: () => Promise.resolve({ code: "UNAUTHORIZED" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({ code: "SUCCESS", message: "ok", data: {} }),
        });

      await customFetch({ url: "/v1/test", method: "GET" });

      const stats = getRefreshStats();
      expect(stats.totalAttempts).toBe(1);
      expect(stats.successCount).toBe(1);
      expect(stats.successRate).toBe(100);
      expect(stats.avgDuration).toBeGreaterThan(0);
    });
  });
});
