// ── All TypeScript interfaces for the workers orchestrator ──

/** Issue statuses matching Paperclip's schema */
export type IssueStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "blocked"
  | "done"
  | "cancelled";

/** A Paperclip issue as returned from the API */
export interface PaperclipIssue {
  id: string;
  companyId: string;
  projectId: string | null;
  title: string;
  description: string | null;
  status: IssueStatus;
  assigneeAgentId: string | null;
  priority: number;
  createdAt: string;
  updatedAt: string;
  labels?: Array<{ id: string; name: string }>;
  parentId?: string | null;
}

/** A Paperclip agent */
export interface PaperclipAgent {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  status: string;
  role: string;
  adapterType: string;
}

/** Comment to post on an issue */
export interface IssueComment {
  issueId: string;
  body: string;
  authorAgentId?: string;
}

/** Result from an adapter executing a task */
export interface AdapterResult {
  success: boolean;
  response: string;
  /** Partial responses collected during streaming */
  partials?: string[];
  /** Duration in milliseconds */
  durationMs: number;
  /** Error message if success=false */
  error?: string;
}

/** Runtime type identifiers for adapters */
export type RuntimeType =
  | "openclaw-telegram"
  | "openclaw-gateway"
  | "hermes-api";

/** Config for a single agent-to-runtime mapping */
export interface AgentRuntimeConfig {
  /** Paperclip agent slug or ID */
  agent: string;
  /** Which runtime adapter to use */
  runtime: RuntimeType;
  /** Runtime-specific endpoint config */
  endpoint: OpenClawTelegramEndpoint | OpenClawGatewayEndpoint | HermesApiEndpoint;
}

export interface OpenClawTelegramEndpoint {
  type: "openclaw-telegram";
  botToken: string;
  chatId: string;
  /** Timeout waiting for response in ms (default: 120000) */
  timeoutMs?: number;
}

export interface OpenClawGatewayEndpoint {
  type: "openclaw-gateway";
  /** WebSocket URL e.g. ws://host:18795 */
  wsUrl: string;
  /** Timeout waiting for response in ms (default: 120000) */
  timeoutMs?: number;
}

export interface HermesApiEndpoint {
  type: "hermes-api";
  /** HTTP URL e.g. http://host:8080 */
  baseUrl: string;
  /** Model identifier for Hermes */
  model?: string;
  /** API key if required */
  apiKey?: string;
  /** Timeout waiting for response in ms (default: 180000) */
  timeoutMs?: number;
}

/** Full worker config loaded from YAML */
export interface WorkerConfig {
  /** Paperclip API base URL */
  paperclip: {
    baseUrl: string;
    apiKey?: string;
    companyId: string;
  };
  /** Poll interval in milliseconds */
  pollIntervalMs: number;
  /** Maximum retries before marking blocked */
  maxRetries: number;
  /** Base delay for exponential backoff in ms */
  retryBaseDelayMs: number;
  /** Agent-to-runtime mappings */
  agents: AgentRuntimeConfig[];
  /** Logging level */
  logLevel: "debug" | "info" | "warn" | "error";
}

/** Task dispatched to an adapter */
export interface TaskPayload {
  issueId: string;
  prompt: string;
  context: {
    title: string;
    description: string | null;
    projectId: string | null;
    labels: string[];
    priority: number;
  };
  agentSlug: string;
}

/** Health check result for a runtime */
export interface HealthCheckResult {
  runtime: RuntimeType;
  agent: string;
  available: boolean;
  latencyMs?: number;
  error?: string;
}
