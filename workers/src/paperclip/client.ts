import type {
  PaperclipCompany,
  PaperclipAgent,
  PaperclipIssue,
  PaperclipComment,
} from '../types.js';
import { log, warn, debug, error as logError } from '../logger.js';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 500;

interface FetchOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string | undefined>;
}

export class PaperclipClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    // Strip trailing slash
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  // ─── Core Fetch with Retry ────────────────────────────────────────

  private async request<T>(path: string, options: FetchOptions = {}): Promise<T> {
    const { method = 'GET', body, params } = options;

    let url = `${this.baseUrl}${path}`;

    // Append query params
    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          searchParams.set(key, value);
        }
      }
      const qs = searchParams.toString();
      if (qs) url += `?${qs}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        debug(`${method} ${url} (attempt ${attempt})`);

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        // If server error, retry with backoff
        if (response.status >= 500) {
          const text = await response.text();
          lastError = new Error(`HTTP ${response.status}: ${text}`);
          if (attempt < MAX_RETRIES) {
            const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
            warn(`Server error ${response.status} on ${method} ${path}, retrying in ${delay}ms...`);
            await this.sleep(delay);
            continue;
          }
          throw lastError;
        }

        // Client errors — don't retry
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`HTTP ${response.status}: ${text}`);
        }

        // 204 No Content
        if (response.status === 204) {
          return undefined as T;
        }

        const data = await response.json();
        return data as T;
      } catch (err) {
        lastError = err as Error;

        // Only retry on network / 5xx errors
        if (attempt < MAX_RETRIES && this.isRetryable(err as Error)) {
          const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
          warn(`Request failed: ${(err as Error).message}, retrying in ${delay}ms...`);
          await this.sleep(delay);
          continue;
        }

        throw err;
      }
    }

    throw lastError ?? new Error('Request failed after max retries');
  }

  private isRetryable(err: Error): boolean {
    const msg = err.message;
    // Retry on network errors and 5xx
    return (
      msg.includes('HTTP 5') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('ECONNRESET') ||
      msg.includes('ETIMEDOUT') ||
      msg.includes('fetch failed') ||
      msg.includes('network')
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─── Company Endpoints ────────────────────────────────────────────

  async getCompanies(): Promise<PaperclipCompany[]> {
    log('Fetching companies...');
    return this.request<PaperclipCompany[]>('/api/companies');
  }

  async getCompanyBySlug(slug: string): Promise<PaperclipCompany | null> {
    log(`Fetching company by slug: ${slug}`);
    const companies = await this.getCompanies();
    return companies.find(c => c.slug === slug) ?? null;
  }

  // ─── Agent Endpoints ──────────────────────────────────────────────

  async getAgents(companyId: string): Promise<PaperclipAgent[]> {
    debug(`Fetching agents for company ${companyId}`);
    return this.request<PaperclipAgent[]>(`/api/companies/${companyId}/agents`);
  }

  // ─── Issue Endpoints ──────────────────────────────────────────────

  async getIssues(
    companyId: string,
    filters?: { status?: string; assigneeAgentId?: string }
  ): Promise<PaperclipIssue[]> {
    debug(`Fetching issues for company ${companyId} with filters:`, filters);
    const params: Record<string, string | undefined> = {};
    if (filters?.status) params.status = filters.status;
    if (filters?.assigneeAgentId) params.assigneeAgentId = filters.assigneeAgentId;
    return this.request<PaperclipIssue[]>(`/api/companies/${companyId}/issues`, { params });
  }

  async getIssue(companyId: string, issueId: string): Promise<PaperclipIssue> {
    debug(`Fetching issue ${issueId} for company ${companyId}`);
    return this.request<PaperclipIssue>(`/api/companies/${companyId}/issues/${issueId}`);
  }

  async updateIssueStatus(
    companyId: string,
    issueId: string,
    status: string
  ): Promise<PaperclipIssue> {
    log(`Updating issue ${issueId} status to "${status}"`);
    return this.request<PaperclipIssue>(
      `/api/companies/${companyId}/issues/${issueId}`,
      {
        method: 'PATCH',
        body: { status },
      }
    );
  }

  async addIssueComment(
    companyId: string,
    issueId: string,
    text: string
  ): Promise<PaperclipComment> {
    debug(`Adding comment to issue ${issueId}`);
    return this.request<PaperclipComment>(
      `/api/companies/${companyId}/issues/${issueId}/comments`,
      {
        method: 'POST',
        body: { text, authorType: 'system', authorId: 'swarm-worker' },
      }
    );
  }
}
