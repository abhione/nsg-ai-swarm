// ─── Paperclip Domain Models ───────────────────────────────────────────

export interface PaperclipCompany {
  id: string;
  name: string;
  slug: string;
  description: string;
}

export interface PaperclipAgent {
  id: string;
  name: string;
  role: string;
  title: string;
  capabilities: string[];
  companyId: string;
  reportsTo: string | null;
}

export interface PaperclipIssue {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeAgentId: string | null;
  companyId: string;
}

export interface PaperclipComment {
  id: string;
  issueId: string;
  text: string;
  authorType: string;
  authorId: string;
  createdAt: string;
}

// ─── Worker Configuration ──────────────────────────────────────────────

export interface AgentMapping {
  name: string;
  runtime: 'openclaw' | 'hermes';
  mode: 'telegram' | 'gateway' | 'api' | 'cli';
  endpoint?: string;
  botToken?: string;
  chatId?: string;
  model?: string;
  timeoutMs?: number;
}

export interface TaskResult {
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
}

export interface WorkerConfig {
  paperclip: {
    url: string;
    companySlug: string;
  };
  polling: {
    intervalMs: number;
    maxConcurrent: number;
  };
  agents: AgentMapping[];
  defaults?: Partial<AgentMapping>;
}

// ─── Internal Event Types ──────────────────────────────────────────────

export interface TaskEvent {
  issue: PaperclipIssue;
  agent: PaperclipAgent;
  mapping: AgentMapping;
}
