// ── Hermes adapter: HTTP API mode with SSE streaming ──

import { BaseAdapter } from "./base.js";
import type {
  AdapterResult,
  HealthCheckResult,
  TaskPayload,
  HermesApiEndpoint,
  AgentRuntimeConfig,
} from "../types.js";
import logger from "../logger.js";

/**
 * Hermes adapter: communicates with a Hermes API server via HTTP.
 * POST /api/chat with streaming SSE response.
 * Extracts final_response from the event stream.
 */
export class HermesAdapter extends BaseAdapter {
  readonly runtimeType = "hermes-api" as const;
  private endpoint: HermesApiEndpoint;
  private abortController: AbortController | null = null;

  constructor(config: AgentRuntimeConfig) {
    super(config);
    this.endpoint = config.endpoint as HermesApiEndpoint;
  }

  async execute(task: TaskPayload): Promise<AdapterResult> {
    const start = Date.now();
    const prompt = this.formatPrompt(task);
    const timeout = this.endpoint.timeoutMs ?? 180_000;
    const partials: string[] = [];

    try {
      const response = await this.sendChatRequest(prompt, task, timeout, partials);
      const durationMs = Date.now() - start;

      return {
        success: true,
        response,
        partials: partials.length > 0 ? partials : undefined,
        durationMs,
      };
    } catch (err) {
      const durationMs = Date.now() - start;
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error("Hermes API execution failed", {
        error: errorMsg,
        issueId: task.issueId,
      });
      return {
        success: false,
        response: "",
        error: errorMsg,
        durationMs,
      };
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const url = `${this.endpoint.baseUrl}/api/health`;
      const res = await fetch(url, {
        headers: this.buildHeaders(),
        signal: AbortSignal.timeout(10_000),
      });
      const latencyMs = Date.now() - start;

      return {
        runtime: this.runtimeType,
        agent: this.config.agent,
        available: res.ok,
        latencyMs,
      };
    } catch (err) {
      return {
        runtime: this.runtimeType,
        agent: this.config.agent,
        available: false,
        error: err instanceof Error ? err.message : String(err),
        latencyMs: Date.now() - start,
      };
    }
  }

  async shutdown(): Promise<void> {
    this.abortController?.abort();
    logger.debug("Hermes adapter shut down", { agent: this.config.agent });
  }

  // ── Private helpers ──

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    };
    if (this.endpoint.apiKey) {
      headers["Authorization"] = `Bearer ${this.endpoint.apiKey}`;
    }
    return headers;
  }

  private async sendChatRequest(
    prompt: string,
    task: TaskPayload,
    timeoutMs: number,
    partials: string[],
  ): Promise<string> {
    this.abortController = new AbortController();
    const url = `${this.endpoint.baseUrl}/api/chat`;

    // Create a combined abort signal with timeout
    const timeoutId = setTimeout(() => {
      this.abortController?.abort();
    }, timeoutMs);

    try {
      const sessionId = `nsg-worker-${task.issueId}-${Date.now()}`;

      const body = {
        message: prompt,
        session_id: sessionId,
        model: this.endpoint.model ?? "default",
        stream: true,
        context: {
          agent: task.agentSlug,
          issue_id: task.issueId,
          project_id: task.context.projectId,
        },
      };

      logger.info("Sending task to Hermes API", {
        url,
        issueId: task.issueId,
        agent: task.agentSlug,
      });

      const res = await fetch(url, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
        signal: this.abortController.signal,
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Hermes API returned ${res.status}: ${errorBody}`);
      }

      const contentType = res.headers.get("content-type") ?? "";

      // Handle SSE streaming response
      if (contentType.includes("text/event-stream")) {
        return await this.parseSSEStream(res, partials);
      }

      // Handle regular JSON response (non-streaming fallback)
      if (contentType.includes("application/json")) {
        return await this.parseJsonResponse(res);
      }

      // Plain text fallback
      return await res.text();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse a Server-Sent Events stream from Hermes.
   *
   * Expected event types:
   *   - event: chunk       → data contains partial text
   *   - event: tool_call   → data contains tool execution info
   *   - event: tool_result → data contains tool result
   *   - event: final_response → data contains the complete response
   *   - event: done        → stream complete
   *   - event: error       → error occurred
   */
  private async parseSSEStream(
    res: Response,
    partials: string[],
  ): Promise<string> {
    if (!res.body) {
      throw new Error("Response body is null — cannot stream");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalResponse = "";
    const textChunks: string[] = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events (double newline delimited)
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? ""; // Keep incomplete event in buffer

        for (const event of events) {
          if (!event.trim()) continue;

          const parsed = this.parseSSEEvent(event);
          if (!parsed) continue;

          const { eventType, data } = parsed;

          switch (eventType) {
            case "chunk":
            case "content": {
              const text = this.extractText(data);
              if (text) {
                textChunks.push(text);
                partials.push(text);
                logger.debug("Hermes chunk received", { length: text.length });
              }
              break;
            }
            case "tool_call": {
              logger.debug("Hermes tool call", { data });
              partials.push(`[tool_call] ${typeof data === "string" ? data : JSON.stringify(data)}`);
              break;
            }
            case "tool_result": {
              logger.debug("Hermes tool result", { data });
              partials.push(`[tool_result] ${typeof data === "string" ? data : JSON.stringify(data)}`);
              break;
            }
            case "final_response": {
              finalResponse = this.extractText(data);
              logger.debug("Hermes final response received", {
                length: finalResponse.length,
              });
              break;
            }
            case "done": {
              logger.debug("Hermes stream complete");
              break;
            }
            case "error": {
              const errorMsg = typeof data === "string" ? data : JSON.stringify(data);
              throw new Error(`Hermes stream error: ${errorMsg}`);
            }
            default: {
              // Unknown event, log and continue
              logger.debug("Unknown Hermes SSE event", { eventType });
              break;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Prefer final_response, fall back to accumulated chunks
    if (finalResponse) return finalResponse;
    if (textChunks.length > 0) return textChunks.join("");

    throw new Error("Hermes stream ended without response content");
  }

  /**
   * Parse a single SSE event block into type + data.
   */
  private parseSSEEvent(
    raw: string,
  ): { eventType: string; data: unknown } | null {
    let eventType = "message";
    let dataLines: string[] = [];

    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      } else if (line.startsWith(":")) {
        // Comment, ignore
        continue;
      }
    }

    if (dataLines.length === 0) return null;

    const dataStr = dataLines.join("\n");
    try {
      return { eventType, data: JSON.parse(dataStr) };
    } catch {
      return { eventType, data: dataStr };
    }
  }

  /**
   * Extract text content from various response data shapes.
   */
  private extractText(data: unknown): string {
    if (typeof data === "string") return data;
    if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      // Common shapes: {text: "..."}, {content: "..."}, {message: "..."}
      return String(obj.text ?? obj.content ?? obj.message ?? obj.response ?? "");
    }
    return String(data);
  }

  /**
   * Handle a non-streaming JSON response.
   */
  private async parseJsonResponse(res: Response): Promise<string> {
    const data = (await res.json()) as Record<string, unknown>;
    return this.extractText(data);
  }
}
