import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useUIStore } from "./ui-store";

describe("uiStore", () => {
  beforeEach(() => {
    // 清理 localStorage
    localStorage.clear();
    // 重置 store 状态
    useUIStore.setState({
      sidebarCollapsed: false,
      sidebarMobileOpen: false,
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("initial state", () => {
    it("should have correct initial state", () => {
      const state = useUIStore.getState();
      expect(state.sidebarCollapsed).toBe(false);
      expect(state.sidebarMobileOpen).toBe(false);
    });
  });

  describe("toggleSidebar", () => {
    it("should toggle sidebarCollapsed from false to true", () => {
      expect(useUIStore.getState().sidebarCollapsed).toBe(false);

      useUIStore.getState().toggleSidebar();

      expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    });

    it("should toggle sidebarCollapsed from true to false", () => {
      useUIStore.setState({ sidebarCollapsed: true });
      expect(useUIStore.getState().sidebarCollapsed).toBe(true);

      useUIStore.getState().toggleSidebar();

      expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    });
  });

  describe("setSidebarCollapsed", () => {
    it("should set sidebarCollapsed to true", () => {
      useUIStore.getState().setSidebarCollapsed(true);

      expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    });

    it("should set sidebarCollapsed to false", () => {
      useUIStore.setState({ sidebarCollapsed: true });

      useUIStore.getState().setSidebarCollapsed(false);

      expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    });
  });

  describe("setSidebarMobileOpen", () => {
    it("should set sidebarMobileOpen to true", () => {
      useUIStore.getState().setSidebarMobileOpen(true);

      expect(useUIStore.getState().sidebarMobileOpen).toBe(true);
    });

    it("should set sidebarMobileOpen to false", () => {
      useUIStore.setState({ sidebarMobileOpen: true });

      useUIStore.getState().setSidebarMobileOpen(false);

      expect(useUIStore.getState().sidebarMobileOpen).toBe(false);
    });
  });

  describe("persistence", () => {
    it("should persist sidebarCollapsed to localStorage", () => {
      useUIStore.getState().setSidebarCollapsed(true);

      const stored = localStorage.getItem("ui-storage");
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed.state.sidebarCollapsed).toBe(true);
    });

    it("should not persist sidebarMobileOpen (partialize)", () => {
      useUIStore.getState().setSidebarMobileOpen(true);

      const stored = localStorage.getItem("ui-storage");
      if (stored) {
        const parsed = JSON.parse(stored);
        // sidebarMobileOpen 不应该被持久化
        expect(parsed.state.sidebarMobileOpen).toBeUndefined();
      }
    });
  });
});
