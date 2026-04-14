import type { WorkerConfig, TaskEvent, TaskResult, AgentMapping } from './types.js';
import { PaperclipClient } from './paperclip/client.js';
import { IssuePoller } from './paperclip/poller.js';
import { RuntimeAdapter } from './adapters/base.js';
import { log, warn, error as logError, debug } from './logger.js';

export class Orchestrator {
  private config: WorkerConfig;
  private client: PaperclipClient;
  private adapters: Map<string, RuntimeAdapter>;
  private poller: IssuePoller;
  private activeTasks = 0;
  private shuttingDown = false;
  private dryRun: boolean;

  constructor(
    config: WorkerConfig,
    client: PaperclipClient,
    adapters: Map<string, RuntimeAdapter>,
    dryRun = false
  ) {
    this.config = config;
    this.client = client;
    this.adapters = adapters;
    this.dryRun = dryRun;

    this.poller = new IssuePoller(client, config);
    this.poller.on('task', (event: TaskEvent) => this.handleTask(event));
  }

  async start(): Promise<void> {
    log('Starting orchestrator...');

    // Run health checks on all adapters
    await this.runHealthChecks();

    // Register shutdown handlers
    this.registerShutdownHandlers();

    // Start polling
    await this.poller.start();

    log('Orchestrator is running. Waiting for tasks...');
  }

  async stop(): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;

    log('Shutting down orchestrator...');
    this.poller.stop();

    // Wait for active tasks to complete (up to 30s)
    if (this.activeTasks > 0) {
      log(`Waiting for ${this.activeTasks} active task(s) to complete...`);
      const deadline = Date.now() + 30_000;
      while (this.activeTasks > 0 && Date.now() < deadline) {
        await this.sleep(1000);
      }
      if (this.activeTasks > 0) {
        warn(`Force-stopping with ${this.activeTasks} task(s) still running`);
      }
    }

    log('Orchestrator stopped.');
  }

  private async handleTask(event: TaskEvent): Promise<void> {
    const { issue, agent, mapping } = event;
    const adapter = this.adapters.get(mapping.runtime);

    if (!adapter) {
      logError(`No adapter registered for runtime: ${mapping.runtime}`);
      this.poller.markComplete(issue.id);
      return;
    }

    // Check concurrency
    if (this.activeTasks >= this.config.polling.maxConcurrent) {
      debug(`Concurrency limit reached, re-queuing issue ${issue.id}`);
      this.poller.markComplete(issue.id);
      return;
    }

    this.activeTasks++;

    // Run task dispatch in background (don't block the event handler)
    this.dispatchTask(issue, agent, mapping, adapter).finally(() => {
      this.activeTasks--;
      this.poller.markComplete(issue.id);
    });
  }

  private async dispatchTask(
    issue: TaskEvent['issue'],
    agent: TaskEvent['agent'],
    mapping: AgentMapping,
    adapter: RuntimeAdapter
  ): Promise<void> {
    const companyId = issue.companyId;

    try {
      // Step 1: Mark issue as in_progress
      if (!this.dryRun) {
        try {
          await this.client.updateIssueStatus(companyId, issue.id, 'in_progress');
        } catch (err) {
          warn(`Failed to update issue status to in_progress: ${(err as Error).message}`);
          // Continue anyway — the task can still be attempted
        }

        // Step 2: Add pickup comment
        try {
          await this.client.addIssueComment(
            companyId,
            issue.id,
            `🤖 ${agent.name} picking up this task...`
          );
        } catch (err) {
          warn(`Failed to add pickup comment: ${(err as Error).message}`);
        }
      } else {
        log(`[DRY-RUN] Would mark issue ${issue.id} as in_progress`);
        log(`[DRY-RUN] Would add pickup comment for ${agent.name}`);
      }

      // Step 3: Execute the task
      log(`Executing task "${issue.title}" via ${adapter.name}/${mapping.mode}...`);

      let result: TaskResult;
      if (this.dryRun) {
        log(`[DRY-RUN] Would execute task for ${agent.name} via ${adapter.name}/${mapping.mode}`);
        result = {
          success: true,
          output: `[DRY-RUN] Task "${issue.title}" would be sent to ${agent.name}`,
          durationMs: 0,
        };
      } else {
        result = await adapter.execute(issue, agent, mapping);
      }

      // Step 4: Handle result
      if (result.success) {
        log(`Task completed successfully for ${agent.name} (${result.durationMs}ms)`);

        if (!this.dryRun) {
          // Update status to done
          try {
            await this.client.updateIssueStatus(companyId, issue.id, 'done');
          } catch (err) {
            warn(`Failed to update issue status to done: ${(err as Error).message}`);
          }

          // Add result comment
          const resultComment = this.formatResultComment(agent.name, result);
          try {
            await this.client.addIssueComment(companyId, issue.id, resultComment);
          } catch (err) {
            warn(`Failed to add result comment: ${(err as Error).message}`);
          }
        } else {
          log(`[DRY-RUN] Would mark issue ${issue.id} as done`);
          log(`[DRY-RUN] Result: ${result.output.substring(0, 200)}...`);
        }
      } else {
        logError(`Task failed for ${agent.name}: ${result.error}`);

        if (!this.dryRun) {
          // Set back to backlog
          try {
            await this.client.updateIssueStatus(companyId, issue.id, 'backlog');
          } catch (err) {
            warn(`Failed to update issue status back to backlog: ${(err as Error).message}`);
          }

          // Add error comment
          const errorComment = this.formatErrorComment(agent.name, result);
          try {
            await this.client.addIssueComment(companyId, issue.id, errorComment);
          } catch (err) {
            warn(`Failed to add error comment: ${(err as Error).message}`);
          }
        } else {
          log(`[DRY-RUN] Would mark issue ${issue.id} back to backlog`);
          log(`[DRY-RUN] Error: ${result.error}`);
        }
      }
    } catch (err) {
      logError(`Unhandled error in task dispatch: ${(err as Error).message}`);

      // Attempt to recover
      if (!this.dryRun) {
        try {
          await this.client.updateIssueStatus(companyId, issue.id, 'backlog');
          await this.client.addIssueComment(
            companyId,
            issue.id,
            `⚠️ Swarm worker error: ${(err as Error).message}`
          );
        } catch (recoveryErr) {
          logError(`Recovery also failed: ${(recoveryErr as Error).message}`);
        }
      }
    }
  }

  private formatResultComment(agentName: string, result: TaskResult): string {
    const output = result.output.length > 4000
      ? result.output.substring(0, 4000) + '\n\n... (truncated)'
      : result.output;

    return [
      `✅ ${agentName} completed this task`,
      `⏱️ Duration: ${this.formatDuration(result.durationMs)}`,
      '',
      '───── Response ─────',
      output,
    ].join('\n');
  }

  private formatErrorComment(agentName: string, result: TaskResult): string {
    return [
      `❌ ${agentName} failed to complete this task`,
      `⏱️ Duration: ${this.formatDuration(result.durationMs)}`,
      '',
      `Error: ${result.error ?? 'Unknown error'}`,
      '',
      result.output ? `Partial output:\n${result.output.substring(0, 1000)}` : '',
    ].filter(Boolean).join('\n');
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60_000);
    const secs = Math.floor((ms % 60_000) / 1000);
    return `${mins}m ${secs}s`;
  }

  private async runHealthChecks(): Promise<void> {
    log('Running adapter health checks...');

    const checks: Promise<void>[] = [];

    for (const agentMapping of this.config.agents) {
      const adapter = this.adapters.get(agentMapping.runtime);
      if (!adapter) {
        warn(`No adapter for runtime "${agentMapping.runtime}" (agent: ${agentMapping.name})`);
        continue;
      }

      checks.push(
        adapter.healthCheck(agentMapping).then((healthy) => {
          if (healthy) {
            log(`  ✅ ${agentMapping.name} (${agentMapping.runtime}/${agentMapping.mode}) — healthy`);
          } else {
            warn(`  ⚠️  ${agentMapping.name} (${agentMapping.runtime}/${agentMapping.mode}) — unreachable`);
          }
        }).catch((err) => {
          warn(`  ⚠️  ${agentMapping.name} health check error: ${(err as Error).message}`);
        })
      );
    }

    await Promise.allSettled(checks);
  }

  private registerShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      log(`Received ${signal}, initiating graceful shutdown...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
