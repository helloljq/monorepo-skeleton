import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  /** Public ID (UUID) */
  id: string;
  email: string | null;
  name?: string | null;
}

interface AuthState {
  user: User | null;
  deviceId: string;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  login: (user: User) => void;
  logout: () => void;
}

const generateDeviceId = (): string => {
  const stored = localStorage.getItem("device-id");
  if (stored) return stored;
  const id = `web-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  localStorage.setItem("device-id", id);
  return id;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      deviceId: generateDeviceId(),
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      login: (user) => {
        set({ user, isAuthenticated: true });
      },
      logout: () => {
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        deviceId: state.deviceId,
      }),
      onRehydrateStorage: () => (state) => {
        // 从 localStorage 恢复后，根据 user 重新计算 isAuthenticated
        if (state) {
          state.isAuthenticated = !!state.user;
        }
      },
    },
  ),
);
