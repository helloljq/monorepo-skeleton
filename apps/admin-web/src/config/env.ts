import { z } from "zod";

const EnvSchema = z.object({
  VITE_APP_ENV: z.enum(["dev", "staging", "prod"]),
  VITE_API_BASE_URL: z.string().min(1),
});

const parsed = EnvSchema.parse(import.meta.env);

// Canonical env used across apps (ADR-ENV-001)
export const APP_ENV = parsed.VITE_APP_ENV;

export const API_BASE_URL = parsed.VITE_API_BASE_URL;
