export type AppEnv = "dev" | "staging" | "prod";

function requireAppEnv(value: unknown): AppEnv {
  if (value === "dev" || value === "staging" || value === "prod") return value;
  throw new Error(
    `Invalid VITE_APP_ENV: ${String(value)} (expected dev|staging|prod)`,
  );
}

function requireNonEmptyString(value: unknown, name: string): string {
  if (typeof value === "string" && value.length > 0) return value;
  throw new Error(`${name} is required`);
}

// Canonical env used across apps (ADR-ENV-001)
export const APP_ENV = requireAppEnv(import.meta.env.VITE_APP_ENV);

export const API_BASE_URL = requireNonEmptyString(
  import.meta.env.VITE_API_BASE_URL,
  "VITE_API_BASE_URL",
);
