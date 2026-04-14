import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { WorkerConfig } from './types.js';
import { error } from './logger.js';

/**
 * Interpolate ${ENV_VAR} references in string values.
 * Walks the entire config tree recursively.
 */
function interpolateEnv(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{([^}]+)\}/g, (_match, varName: string) => {
      const val = process.env[varName];
      if (val === undefined) {
        error(`Environment variable \${${varName}} is not set`);
        return '';
      }
      return val;
    });
  }
  if (Array.isArray(obj)) {
    return obj.map(interpolateEnv);
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = interpolateEnv(value);
    }
    return result;
  }
  return obj;
}

/**
 * Validate that required top-level fields exist in the config.
 */
function validate(config: unknown): asserts config is WorkerConfig {
  const c = config as Record<string, unknown>;

  if (!c.paperclip || typeof c.paperclip !== 'object') {
    throw new Error('Config missing required field: paperclip');
  }
  const pc = c.paperclip as Record<string, unknown>;
  if (!pc.url || typeof pc.url !== 'string') {
    throw new Error('Config missing required field: paperclip.url');
  }
  if (!pc.companySlug || typeof pc.companySlug !== 'string') {
    throw new Error('Config missing required field: paperclip.companySlug');
  }

  if (!c.polling || typeof c.polling !== 'object') {
    throw new Error('Config missing required field: polling');
  }
  const poll = c.polling as Record<string, unknown>;
  if (typeof poll.intervalMs !== 'number' || poll.intervalMs < 1000) {
    throw new Error('Config polling.intervalMs must be a number >= 1000');
  }
  if (typeof poll.maxConcurrent !== 'number' || poll.maxConcurrent < 1) {
    throw new Error('Config polling.maxConcurrent must be a number >= 1');
  }

  if (!Array.isArray(c.agents) || c.agents.length === 0) {
    throw new Error('Config must have at least one agent in agents[]');
  }

  for (const agent of c.agents as Record<string, unknown>[]) {
    if (!agent.name || typeof agent.name !== 'string') {
      throw new Error('Each agent must have a name');
    }
    const runtime = agent.runtime as string;
    if (!['openclaw', 'hermes'].includes(runtime)) {
      throw new Error(`Agent "${agent.name}" has invalid runtime: ${runtime}. Must be 'openclaw' or 'hermes'.`);
    }
    const mode = agent.mode as string;
    if (!['telegram', 'gateway', 'api', 'cli'].includes(mode)) {
      throw new Error(`Agent "${agent.name}" has invalid mode: ${mode}. Must be 'telegram', 'gateway', 'api', or 'cli'.`);
    }
  }
}

/**
 * Resolve the config file path from CLI args or env.
 */
function resolveConfigPath(): string {
  // Check --config CLI arg
  const args = process.argv.slice(2);
  const configIdx = args.indexOf('--config');
  if (configIdx !== -1 && args[configIdx + 1]) {
    return resolve(args[configIdx + 1]);
  }

  // Check WORKER_CONFIG env
  const envPath = process.env.WORKER_CONFIG;
  if (envPath) {
    return resolve(envPath);
  }

  // Default
  return resolve('config.yaml');
}

/**
 * Load and parse YAML config, interpolate env vars, validate.
 */
export function loadConfig(overridePath?: string): WorkerConfig {
  const configPath = overridePath ? resolve(overridePath) : resolveConfigPath();

  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf-8');
  } catch (err) {
    throw new Error(`Cannot read config file: ${configPath}\n${(err as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    throw new Error(`Invalid YAML in config file: ${configPath}\n${(err as Error).message}`);
  }

  const interpolated = interpolateEnv(parsed);
  validate(interpolated);

  // Apply defaults to agents that don't have all fields
  const config = interpolated as WorkerConfig;
  if (config.defaults) {
    config.agents = config.agents.map(agent => ({
      ...config.defaults,
      ...agent,
    })) as WorkerConfig['agents'];
  }

  return config;
}
