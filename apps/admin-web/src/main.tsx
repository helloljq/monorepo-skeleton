import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { BrowserRouter } from "react-router-dom";

import { queryClient } from "@/lib/query-client";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/common";
import { useAuthStore } from "@/stores/auth-store";
import { createLogger } from "@/lib/logger";

import App from "./App";
import "./index.css";

// 创建多标签页同步专用 logger
const syncLogger = createLogger("[Tab Sync]");

// 多标签页同步：监听 localStorage 变化
const handleStorageChange = (e: StorageEvent) => {
  if (e.key === "auth-storage" && e.newValue) {
    try {
      const newState = JSON.parse(e.newValue);
      const currentState = useAuthStore.getState();

      const newUser = newState.state.user;
      const currentUser = currentState.user;
      const newIsAuthenticated = !!newUser;
      const currentIsAuthenticated = currentState.isAuthenticated;

      // 检查是否需要同步（用户变化或认证状态变化）
      if (
        newUser?.id !== currentUser?.id ||
        newIsAuthenticated !== currentIsAuthenticated
      ) {
        syncLogger.log("Auth state synced from another tab", {
          isAuthenticated: newIsAuthenticated,
          userId: newUser?.id,
        });

        useAuthStore.setState({
          user: newUser,
          isAuthenticated: newIsAuthenticated,
        });

        // 如果其他标签页登出，当前标签页也需要跳转到登录页
        if (!newIsAuthenticated && window.location.pathname !== "/login") {
          syncLogger.log(
            "User logged out in another tab, redirecting to login",
          );
          window.location.href = "/login";
        }
      }
    } catch (error) {
      syncLogger.error("Failed to sync auth state:", error);
    }
  }
};

window.addEventListener("storage", handleStorageChange);

// HMR 清理：避免重复绑定事件
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener("storage", handleStorageChange);
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <Toaster position="top-center" />
        </BrowserRouter>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
