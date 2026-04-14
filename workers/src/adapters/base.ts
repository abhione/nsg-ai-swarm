// ── Abstract adapter class ──

import type {
  AdapterResult,
  HealthCheckResult,
  TaskPayload,
  RuntimeType,
  AgentRuntimeConfig,
} from "../types.js";

/**
 * Base class for all runtime adapters.
 * Each adapter bridges between the orchestrator's task model
 * and a specific AI agent runtime (OpenClaw, Hermes, etc).
 */
export abstract class BaseAdapter {
  /** Which runtime type this adapter handles */
  abstract readonly runtimeType: RuntimeType;

  /** The agent config this adapter was created for */
  protected config: AgentRuntimeConfig;

  constructor(config: AgentRuntimeConfig) {
    this.config = config;
  }

  /**
   * Execute a task and return the result.
   * Implementations handle protocol specifics (WS, HTTP, Telegram Bot API).
   */
  abstract execute(task: TaskPayload): Promise<AdapterResult>;

  /**
   * Perform a health/connectivity check against the runtime.
   */
  abstract healthCheck(): Promise<HealthCheckResult>;

  /**
   * Graceful shutdown - close connections, cancel pending requests.
   */
  abstract shutdown(): Promise<void>;

  /**
   * Format a task into a prompt string suitable for the runtime.
   */
  protected formatPrompt(task: TaskPayload): string {
    const parts: string[] = [];

    parts.push(`## Task: ${task.context.title}`);
    parts.push("");

    if (task.context.description) {
      parts.push(task.context.description);
      parts.push("");
    }

    if (task.context.labels.length > 0) {
      parts.push(`Labels: ${task.context.labels.join(", ")}`);
    }

    parts.push(`Priority: ${task.context.priority}`);
    parts.push(`Issue ID: ${task.issueId}`);

    if (task.context.projectId) {
      parts.push(`Project ID: ${task.context.projectId}`);
    }

    return parts.join("\n");
  }

  /**
   * Utility: sleep for a given number of milliseconds.
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
