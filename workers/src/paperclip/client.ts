// ── REST client for Paperclip API (issues, agents, comments) ──

import type {
  PaperclipIssue,
  PaperclipAgent,
  IssueComment,
  IssueStatus,
  WorkerConfig,
} from "../types.js";
import logger from "../logger.js";

export class PaperclipClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseBody?: string,
  ) {
    super(message);
    this.name = "PaperclipClientError";
  }
}

export class PaperclipClient {
  private baseUrl: string;
  private apiKey: string | undefined;
  private companyId: string;

  constructor(config: WorkerConfig["paperclip"]) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
    this.companyId = config.companyId;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (this.apiKey) {
      h["Authorization"] = `Bearer ${this.apiKey}`;
    }
    return h;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    logger.debug(`Paperclip ${method} ${path}`);

    const res = await fetch(url, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });

    const text = await res.text();

    if (!res.ok) {
      throw new PaperclipClientError(
        `Paperclip API ${method} ${path} returned ${res.status}`,
        res.status,
        text,
      );
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  /** Health check: GET /api/health */
  async health(): Promise<boolean> {
    try {
      await this.request<unknown>("GET", "/api/health");
      return true;
    } catch (err) {
      logger.warn("Paperclip health check failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  /** List agents for the company */
  async listAgents(): Promise<PaperclipAgent[]> {
    return this.request<PaperclipAgent[]>(
      "GET",
      `/api/companies/${this.companyId}/agents`,
    );
  }

  /** Get a single agent by ID or slug */
  async getAgent(agentIdOrSlug: string): Promise<PaperclipAgent | null> {
    try {
      return await this.request<PaperclipAgent>(
        "GET",
        `/api/companies/${this.companyId}/agents/${agentIdOrSlug}`,
      );
    } catch (err) {
      if (err instanceof PaperclipClientError && err.statusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  /** List issues with optional filters */
  async listIssues(filters?: {
    status?: IssueStatus;
    assigneeAgentId?: string;
  }): Promise<PaperclipIssue[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.assigneeAgentId)
      params.set("assigneeAgentId", filters.assigneeAgentId);

    const qs = params.toString();
    const path = `/api/companies/${this.companyId}/issues${qs ? `?${qs}` : ""}`;
    return this.request<PaperclipIssue[]>("GET", path);
  }

  /** Get a single issue by ID */
  async getIssue(issueId: string): Promise<PaperclipIssue | null> {
    try {
      return await this.request<PaperclipIssue>(
        "GET",
        `/api/companies/${this.companyId}/issues/${issueId}`,
      );
    } catch (err) {
      if (err instanceof PaperclipClientError && err.statusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  /** Update issue status */
  async updateIssueStatus(
    issueId: string,
    status: IssueStatus,
  ): Promise<PaperclipIssue> {
    return this.request<PaperclipIssue>(
      "PATCH",
      `/api/companies/${this.companyId}/issues/${issueId}`,
      { status },
    );
  }

  /** Post a comment on an issue */
  async postComment(comment: IssueComment): Promise<void> {
    await this.request(
      "POST",
      `/api/companies/${this.companyId}/issues/${comment.issueId}/comments`,
      {
        body: comment.body,
        ...(comment.authorAgentId && { authorAgentId: comment.authorAgentId }),
      },
    );
  }

  /** List comments for an issue */
  async listComments(
    issueId: string,
  ): Promise<Array<{ id: string; body: string; createdAt: string }>> {
    return this.request(
      "GET",
      `/api/companies/${this.companyId}/issues/${issueId}/comments`,
    );
  }
}
