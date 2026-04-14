// ── Core orchestrator loop: poll tasks, dispatch, collect results, report back ──

import type {
  WorkerConfig,
  AdapterResult,
  TaskPayload,
  HealthCheckResult,
  AgentRuntimeConfig,
} from "./types.js";
import { PaperclipClient } from "./paperclip/client.js";
import { TaskPoller, type ActionableTask } from "./paperclip/poller.js";
import { BaseAdapter } from "./adapters/base.js";
import { OpenClawTelegramAdapter, OpenClawGatewayAdapter } from "./adapters/openclaw.js";
import { HermesAdapter } from "./adapters/hermes.js";
import logger from "./logger.js";

export class Orchestrator {
  private config: WorkerConfig;
  private client: PaperclipClient;
  private poller: TaskPoller;
  private adapters = new Map<string, BaseAdapter>();
  private running = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  /** Track in-flight tasks to prevent double-dispatch */
  private inFlight = new Set<string>();

  constructor(config: WorkerConfig) {
    this.config = config;
    this.client = new PaperclipClient(config.paperclip);
    this.poller = new TaskPoller(this.client, config.agents);
  }

  /**
   * Initialize adapters, run health checks, warm caches.
   */
  async initialize(): Promise<void> {
    logger.info("Initializing orchestrator...");

    // Create adapters for each agent config
    for (const agentConfig of this.config.agents) {
      const adapter = this.createAdapter(agentConfig);
      this.adapters.set(agentConfig.agent, adapter);
      logger.info(`Registered adapter for agent "${agentConfig.agent}"`, {
        runtime: agentConfig.runtime,
      });
    }

    // Check Paperclip health
    const paperclipOk = await this.client.health();
    if (paperclipOk) {
      logger.info("Paperclip API is reachable");
    } else {
      logger.warn("Paperclip API is not reachable — will retry on poll");
    }

    // Warm the agent cache
    await this.poller.warmCache();

    // Run health checks on all runtimes
    await this.runHealthChecks();
  }

  /**
   * Run health checks against all configured runtimes.
   */
  async runHealthChecks(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];

    for (const [agentSlug, adapter] of this.adapters) {
      const result = await adapter.healthCheck();
      results.push(result);

      if (result.available) {
        logger.info(`Runtime healthy: ${agentSlug}`, {
          runtime: result.runtime,
          latencyMs: result.latencyMs,
        });
      } else {
        logger.warn(`Runtime unavailable: ${agentSlug}`, {
          runtime: result.runtime,
          error: result.error,
        });
      }
    }

    return results;
  }

  /**
   * Start the polling loop.
   */
  async start(): Promise<void> {
    this.running = true;
    logger.info("Orchestrator started", {
      pollIntervalMs: this.config.pollIntervalMs,
      agents: this.config.agents.map((a) => a.agent),
    });

    await this.pollLoop();
  }

  /**
   * Stop the polling loop and shut down adapters.
   */
  async stop(): Promise<void> {
    logger.info("Orchestrator stopping...");
    this.running = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    // Wait for in-flight tasks to settle (max 30s)
    const deadline = Date.now() + 30_000;
    while (this.inFlight.size > 0 && Date.now() < deadline) {
      logger.info(`Waiting for ${this.inFlight.size} in-flight task(s)...`);
      await new Promise((r) => setTimeout(r, 1000));
    }

    // Shut down all adapters
    for (const [agent, adapter] of this.adapters) {
      try {
        await adapter.shutdown();
      } catch (err) {
        logger.error(`Error shutting down adapter for ${agent}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info("Orchestrator stopped");
  }

  // ── Private ──

  private async pollLoop(): Promise<void> {
    while (this.running) {
      try {
        const tasks = await this.poller.poll();

        for (const task of tasks) {
          // Skip if already in-flight
          if (this.inFlight.has(task.issue.id)) {
            logger.debug("Skipping in-flight issue", { issueId: task.issue.id });
            continue;
          }

          // Dispatch asynchronously (don't block the poll loop)
          this.dispatchTask(task).catch((err) => {
            logger.error("Unhandled dispatch error", {
              issueId: task.issue.id,
              error: err instanceof Error ? err.message : String(err),
            });
          });
        }
      } catch (err) {
        logger.error("Poll loop error", {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Wait for the poll interval
      if (this.running) {
        await new Promise<void>((resolve) => {
          this.pollTimer = setTimeout(resolve, this.config.pollIntervalMs);
        });
      }
    }
  }

  /**
   * Dispatch a single task to its adapter, with retry logic.
   */
  private async dispatchTask(actionable: ActionableTask): Promise<void> {
    const { issue, agent, runtimeConfig } = actionable;
    const adapter = this.adapters.get(runtimeConfig.agent);

    if (!adapter) {
      logger.error(`No adapter found for agent ${runtimeConfig.agent}`);
      return;
    }

    this.inFlight.add(issue.id);

    try {
      // Transition issue to in_progress
      await this.client.updateIssueStatus(issue.id, "in_progress");
      logger.info(`Dispatching task`, {
        issueId: issue.id,
        title: issue.title,
        agent: agent.slug,
        runtime: runtimeConfig.runtime,
      });

      // Build task payload
      const task: TaskPayload = {
        issueId: issue.id,
        prompt: "", // Will be formatted by adapter
        context: {
          title: issue.title,
          description: issue.description,
          projectId: issue.projectId,
          labels: issue.labels?.map((l) => l.name) ?? [],
          priority: issue.priority,
        },
        agentSlug: agent.slug,
      };

      // Execute with retry
      const result = await this.executeWithRetry(adapter, task);

      if (result.success) {
        // Post result as comment
        await this.client.postComment({
          issueId: issue.id,
          body: this.formatResultComment(result, agent.slug),
          authorAgentId: agent.id,
        });

        // Mark as done
        await this.client.updateIssueStatus(issue.id, "done");
        logger.info(`Task completed`, {
          issueId: issue.id,
          durationMs: result.durationMs,
        });
      } else {
        // Post error comment and mark as blocked
        await this.client.postComment({
          issueId: issue.id,
          body: this.formatErrorComment(result, agent.slug),
          authorAgentId: agent.id,
        });

        await this.client.updateIssueStatus(issue.id, "blocked");
        logger.warn(`Task failed, marked as blocked`, {
          issueId: issue.id,
          error: result.error,
        });
      }
    } catch (err) {
      logger.error(`Dispatch failed for issue ${issue.id}`, {
        error: err instanceof Error ? err.message : String(err),
      });

      // Try to mark as blocked
      try {
        await this.client.postComment({
          issueId: issue.id,
          body: `**Worker Error**\n\nFailed to process task: ${err instanceof Error ? err.message : String(err)}`,
        });
        await this.client.updateIssueStatus(issue.id, "blocked");
      } catch {
        logger.error("Failed to update issue status after dispatch error", {
          issueId: issue.id,
        });
      }
    } finally {
      this.inFlight.delete(issue.id);
    }
  }

  /**
   * Execute a task with exponential backoff retry.
   */
  private async executeWithRetry(
    adapter: BaseAdapter,
    task: TaskPayload,
  ): Promise<AdapterResult> {
    let lastResult: AdapterResult | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      logger.debug(`Execution attempt ${attempt}/${this.config.maxRetries}`, {
        issueId: task.issueId,
      });

      lastResult = await adapter.execute(task);

      if (lastResult.success) {
        return lastResult;
      }

      // Don't retry on the last attempt
      if (attempt < this.config.maxRetries) {
        const delay = this.config.retryBaseDelayMs * Math.pow(2, attempt - 1);
        logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms`, {
          issueId: task.issueId,
          error: lastResult.error,
        });
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    return lastResult ?? {
      success: false,
      response: "",
      error: "No execution attempts made",
      durationMs: 0,
    };
  }

  /**
   * Create the appropriate adapter for an agent runtime config.
   */
  private createAdapter(config: AgentRuntimeConfig): BaseAdapter {
    switch (config.runtime) {
      case "openclaw-telegram":
        return new OpenClawTelegramAdapter(config);
      case "openclaw-gateway":
        return new OpenClawGatewayAdapter(config);
      case "hermes-api":
        return new HermesAdapter(config);
      default:
        throw new Error(`Unknown runtime type: ${config.runtime}`);
    }
  }

  /**
   * Format a successful result as a Paperclip issue comment.
   */
  private formatResultComment(result: AdapterResult, agentSlug: string): string {
    const lines = [
      `**Agent Response** (${agentSlug})`,
      "",
      result.response,
      "",
      `---`,
      `*Completed in ${(result.durationMs / 1000).toFixed(1)}s*`,
    ];
    return lines.join("\n");
  }

  /**
   * Format an error result as a Paperclip issue comment.
   */
  private formatErrorComment(result: AdapterResult, agentSlug: string): string {
    const lines = [
      `**Task Failed** (${agentSlug})`,
      "",
      `Error: ${result.error ?? "Unknown error"}`,
      "",
      `The task has been retried ${this.config.maxRetries} times and marked as blocked.`,
      "",
      `---`,
      `*Failed after ${(result.durationMs / 1000).toFixed(1)}s*`,
    ];
    return lines.join("\n");
  }
}
