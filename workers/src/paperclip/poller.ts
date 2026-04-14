import { EventEmitter } from 'node:events';
import type {
  PaperclipAgent,
  PaperclipIssue,
  AgentMapping,
  TaskEvent,
  WorkerConfig,
} from '../types.js';
import { PaperclipClient } from './client.js';
import { log, warn, debug, error as logError } from '../logger.js';

const ACTIONABLE_STATUSES = ['backlog', 'todo'];

export class IssuePoller extends EventEmitter {
  private client: PaperclipClient;
  private config: WorkerConfig;
  private companyId: string | null = null;
  private agents: PaperclipAgent[] = [];
  private agentMappings: Map<string, AgentMapping>;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private inFlight: Set<string> = new Set();
  private running = false;

  constructor(client: PaperclipClient, config: WorkerConfig) {
    super();
    this.client = client;
    this.config = config;

    // Build lookup of agent name → mapping
    this.agentMappings = new Map();
    for (const mapping of config.agents) {
      this.agentMappings.set(mapping.name.toLowerCase(), mapping);
    }
  }

  async start(): Promise<void> {
    if (this.running) {
      warn('Poller is already running');
      return;
    }

    log('Starting issue poller...');

    // Resolve company
    const company = await this.client.getCompanyBySlug(this.config.paperclip.companySlug);
    if (!company) {
      throw new Error(`Company not found with slug: ${this.config.paperclip.companySlug}`);
    }
    this.companyId = company.id;
    log(`Resolved company "${company.name}" (${company.id})`);

    // Fetch agents once
    this.agents = await this.client.getAgents(this.companyId);
    log(`Loaded ${this.agents.length} agents from Paperclip`);

    this.running = true;

    // Initial poll immediately
    await this.poll();

    // Then schedule
    this.intervalHandle = setInterval(async () => {
      try {
        await this.poll();
      } catch (err) {
        logError('Poll cycle error:', (err as Error).message);
      }
    }, this.config.polling.intervalMs);

    log(`Polling every ${this.config.polling.intervalMs / 1000}s`);
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.running = false;
    log('Issue poller stopped');
  }

  isInFlight(issueId: string): boolean {
    return this.inFlight.has(issueId);
  }

  markComplete(issueId: string): void {
    this.inFlight.delete(issueId);
    debug(`Issue ${issueId} removed from in-flight tracking`);
  }

  get inFlightCount(): number {
    return this.inFlight.size;
  }

  private async poll(): Promise<void> {
    if (!this.companyId) return;

    debug('Polling for actionable issues...');

    let allIssues: PaperclipIssue[] = [];
    try {
      allIssues = await this.client.getIssues(this.companyId);
    } catch (err) {
      logError('Failed to fetch issues:', (err as Error).message);
      return;
    }

    // Filter to actionable issues
    const actionable = allIssues.filter(issue => {
      // Must be in an actionable status
      if (!ACTIONABLE_STATUSES.includes(issue.status)) return false;

      // Must have an assignee
      if (!issue.assigneeAgentId) return false;

      // Must not already be in-flight
      if (this.inFlight.has(issue.id)) return false;

      // Assignee must match a configured agent
      const agent = this.agents.find(a => a.id === issue.assigneeAgentId);
      if (!agent) return false;

      const mapping = this.agentMappings.get(agent.name.toLowerCase());
      if (!mapping) return false;

      return true;
    });

    if (actionable.length === 0) {
      debug('No actionable issues found');
      return;
    }

    log(`Found ${actionable.length} actionable issue(s)`);

    // Check concurrency limit
    const maxConcurrent = this.config.polling.maxConcurrent;
    const available = maxConcurrent - this.inFlight.size;

    if (available <= 0) {
      debug(`At concurrency limit (${this.inFlight.size}/${maxConcurrent}), skipping dispatch`);
      return;
    }

    // Dispatch up to available slots
    const toDispatch = actionable.slice(0, available);

    for (const issue of toDispatch) {
      const agent = this.agents.find(a => a.id === issue.assigneeAgentId)!;
      const mapping = this.agentMappings.get(agent.name.toLowerCase())!;

      // Mark in-flight to prevent double-dispatch
      this.inFlight.add(issue.id);

      const taskEvent: TaskEvent = { issue, agent, mapping };
      log(`Dispatching issue "${issue.title}" → ${agent.name} (${mapping.runtime}/${mapping.mode})`);
      this.emit('task', taskEvent);
    }
  }
}
