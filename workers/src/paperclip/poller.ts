// ── Polls for actionable tasks (status=todo, assigned to agent) ──

import type { PaperclipIssue, PaperclipAgent, AgentRuntimeConfig } from "../types.js";
import type { PaperclipClient } from "./client.js";
import logger from "../logger.js";

export interface ActionableTask {
  issue: PaperclipIssue;
  agent: PaperclipAgent;
  runtimeConfig: AgentRuntimeConfig;
}

/**
 * TaskPoller checks Paperclip for issues that are ready to be picked up.
 * An issue is actionable when:
 *   - status == "todo"
 *   - assigneeAgentId matches one of the configured agent mappings
 */
export class TaskPoller {
  private client: PaperclipClient;
  private agentConfigs: AgentRuntimeConfig[];
  /** Cache: agent slug -> PaperclipAgent */
  private agentCache = new Map<string, PaperclipAgent>();

  constructor(client: PaperclipClient, agentConfigs: AgentRuntimeConfig[]) {
    this.client = client;
    this.agentConfigs = agentConfigs;
  }

  /**
   * Warm the agent cache by fetching all configured agents from Paperclip.
   */
  async warmCache(): Promise<void> {
    for (const cfg of this.agentConfigs) {
      try {
        const agent = await this.client.getAgent(cfg.agent);
        if (agent) {
          this.agentCache.set(cfg.agent, agent);
          // Also cache by ID for reverse lookups
          this.agentCache.set(agent.id, agent);
          logger.debug(`Cached agent ${cfg.agent}`, { id: agent.id, name: agent.name });
        } else {
          logger.warn(`Agent not found in Paperclip: ${cfg.agent}`);
        }
      } catch (err) {
        logger.error(`Failed to fetch agent ${cfg.agent}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  /**
   * Poll for actionable tasks.
   * Returns issues that are status=todo and assigned to one of our configured agents.
   */
  async poll(): Promise<ActionableTask[]> {
    const tasks: ActionableTask[] = [];

    try {
      // Fetch all todo issues
      const issues = await this.client.listIssues({ status: "todo" });

      for (const issue of issues) {
        if (!issue.assigneeAgentId) continue;

        // Find matching runtime config
        const runtimeConfig = this.findRuntimeConfig(issue.assigneeAgentId);
        if (!runtimeConfig) continue;

        // Resolve the agent
        const agent = this.resolveAgent(issue.assigneeAgentId);
        if (!agent) {
          logger.warn(`Issue ${issue.id} assigned to unknown agent ${issue.assigneeAgentId}`);
          continue;
        }

        tasks.push({ issue, agent, runtimeConfig });
      }

      if (tasks.length > 0) {
        logger.info(`Found ${tasks.length} actionable task(s)`, {
          issues: tasks.map((t) => t.issue.id),
        });
      }
    } catch (err) {
      logger.error("Poll failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return tasks;
  }

  /**
   * Find the runtime config for a given agent ID.
   */
  private findRuntimeConfig(agentId: string): AgentRuntimeConfig | undefined {
    // Direct match by slug/id in config
    const direct = this.agentConfigs.find((c) => c.agent === agentId);
    if (direct) return direct;

    // Try to reverse-lookup: find cached agent by ID, then match by slug
    const cachedAgent = this.agentCache.get(agentId);
    if (cachedAgent) {
      return this.agentConfigs.find((c) => c.agent === cachedAgent.slug);
    }

    return undefined;
  }

  /**
   * Resolve an agent from cache by ID or slug.
   */
  private resolveAgent(agentIdOrSlug: string): PaperclipAgent | undefined {
    return this.agentCache.get(agentIdOrSlug);
  }
}
