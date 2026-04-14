// ── YAML config loader with env var interpolation ──

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";
import type { WorkerConfig, AgentRuntimeConfig } from "./types.js";
import logger from "./logger.js";

/**
 * Interpolate ${ENV_VAR} and ${ENV_VAR:-default} patterns in a string.
 */
function interpolateEnv(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_match, expr: string) => {
    const [envKey, ...defaultParts] = expr.split(":-");
    const defaultValue = defaultParts.join(":-");
    const envValue = process.env[envKey!.trim()];
    if (envValue !== undefined) return envValue;
    if (defaultParts.length > 0) return defaultValue;
    logger.warn(`Environment variable ${envKey} is not set and has no default`);
    return "";
  });
}

/**
 * Recursively walk an object and interpolate env vars in all string values.
 */
function interpolateDeep(obj: unknown): unknown {
  if (typeof obj === "string") return interpolateEnv(obj);
  if (Array.isArray(obj)) return obj.map(interpolateDeep);
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = interpolateDeep(val);
    }
    return result;
  }
  return obj;
}

/** Default config values */
const DEFAULTS: Partial<WorkerConfig> = {
  pollIntervalMs: 5000,
  maxRetries: 3,
  retryBaseDelayMs: 1000,
  logLevel: "info",
};

/**
 * Load and validate a worker config from a YAML file.
 */
export function loadConfig(configPath: string): WorkerConfig {
  const absPath = resolve(configPath);

  if (!existsSync(absPath)) {
    throw new ConfigError(`Config file not found: ${absPath}`);
  }

  const raw = readFileSync(absPath, "utf-8");
  const parsed = YAML.parse(raw);

  if (!parsed || typeof parsed !== "object") {
    throw new ConfigError("Config file is empty or not a valid YAML object");
  }

  const interpolated = interpolateDeep(parsed) as Record<string, unknown>;

  // Merge defaults
  const config: WorkerConfig = {
    paperclip: validatePaperclipConfig(interpolated.paperclip),
    pollIntervalMs: asNumber(interpolated.pollIntervalMs, DEFAULTS.pollIntervalMs!),
    maxRetries: asNumber(interpolated.maxRetries, DEFAULTS.maxRetries!),
    retryBaseDelayMs: asNumber(interpolated.retryBaseDelayMs, DEFAULTS.retryBaseDelayMs!),
    agents: validateAgentsConfig(interpolated.agents),
    logLevel: validateLogLevel(interpolated.logLevel as string | undefined),
  };

  logger.debug("Loaded config", { path: absPath, agents: config.agents.length });
  return config;
}

function validatePaperclipConfig(raw: unknown): WorkerConfig["paperclip"] {
  if (!raw || typeof raw !== "object") {
    throw new ConfigError("Missing 'paperclip' section in config");
  }
  const obj = raw as Record<string, unknown>;
  if (!obj.baseUrl || typeof obj.baseUrl !== "string") {
    throw new ConfigError("paperclip.baseUrl is required");
  }
  if (!obj.companyId || typeof obj.companyId !== "string") {
    throw new ConfigError("paperclip.companyId is required");
  }
  return {
    baseUrl: obj.baseUrl,
    apiKey: typeof obj.apiKey === "string" ? obj.apiKey : undefined,
    companyId: obj.companyId,
  };
}

function validateAgentsConfig(raw: unknown): AgentRuntimeConfig[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ConfigError("'agents' must be a non-empty array");
  }
  return raw.map((item, idx) => {
    if (!item || typeof item !== "object") {
      throw new ConfigError(`agents[${idx}] must be an object`);
    }
    const obj = item as Record<string, unknown>;
    if (!obj.agent || typeof obj.agent !== "string") {
      throw new ConfigError(`agents[${idx}].agent is required`);
    }
    if (!obj.runtime || typeof obj.runtime !== "string") {
      throw new ConfigError(`agents[${idx}].runtime is required`);
    }
    if (!obj.endpoint || typeof obj.endpoint !== "object") {
      throw new ConfigError(`agents[${idx}].endpoint is required`);
    }
    return {
      agent: obj.agent,
      runtime: obj.runtime as AgentRuntimeConfig["runtime"],
      endpoint: { ...obj.endpoint, type: obj.runtime } as AgentRuntimeConfig["endpoint"],
    };
  });
}

function validateLogLevel(raw: string | undefined): WorkerConfig["logLevel"] {
  const valid = ["debug", "info", "warn", "error"];
  if (!raw) return DEFAULTS.logLevel as WorkerConfig["logLevel"];
  if (!valid.includes(raw)) {
    throw new ConfigError(`logLevel must be one of: ${valid.join(", ")}`);
  }
  return raw as WorkerConfig["logLevel"];
}

function asNumber(val: unknown, defaultVal: number): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = Number(val);
    if (!Number.isNaN(n)) return n;
  }
  return defaultVal;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}
