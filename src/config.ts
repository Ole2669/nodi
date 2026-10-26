import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type NodiConfig = {
  gatewayUrl: string;
  timeoutMs: number;
  learnTimeoutMs: number;
  username?: string;
  password?: string;
  dataDir: string;
};

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv(): void {
  const path = resolve(ROOT, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}

export function loadConfig(overrides: Partial<NodiConfig> = {}): NodiConfig {
  loadDotEnv();
  return {
    gatewayUrl: (
      overrides.gatewayUrl ??
      process.env.GATEWAY_URL ??
      "http://192.168.178.38"
    ).replace(/\/$/, ""),
    timeoutMs: overrides.timeoutMs ?? Number(process.env.TIMEOUT_MS ?? 4000),
    learnTimeoutMs:
      overrides.learnTimeoutMs ?? Number(process.env.LEARN_TIMEOUT_MS ?? 90_000),
    username: overrides.username ?? process.env.XC_USER,
    password: overrides.password ?? process.env.XC_PASS,
    dataDir: overrides.dataDir ?? resolve(ROOT, "data"),
  };
}
