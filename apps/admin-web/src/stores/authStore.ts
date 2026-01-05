import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: number;
  email: string;
  name?: string | null;
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresInSeconds: number;
}

interface AuthState {
  user: User | null;
  tokens: Tokens | null;
  deviceId: string;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setTokens: (tokens: Tokens | null) => void;
  login: (user: User, tokens: Tokens) => void;
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
      tokens: null,
      deviceId: generateDeviceId(),
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setTokens: (tokens) => set({ tokens, isAuthenticated: !!tokens }),
      login: (user, tokens) => {
        set({ user, tokens, isAuthenticated: true });
      },
      logout: () => {
        set({ user: null, tokens: null, isAuthenticated: false });
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        deviceId: state.deviceId,
      }),
      onRehydrateStorage: () => (state) => {
        // 从 localStorage 恢复后，根据 tokens 重新计算 isAuthenticated
        if (state) {
          state.isAuthenticated = !!state.tokens;
        }
      },
    },
  ),
);
