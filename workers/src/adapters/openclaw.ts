// ── OpenClaw adapter: Telegram Bot API + WebSocket Gateway modes ──

import WebSocket from "ws";
import { BaseAdapter } from "./base.js";
import type {
  AdapterResult,
  HealthCheckResult,
  TaskPayload,
  OpenClawTelegramEndpoint,
  OpenClawGatewayEndpoint,
  AgentRuntimeConfig,
} from "../types.js";
import logger from "../logger.js";

// ── Telegram Bot API Mode ──

/**
 * OpenClaw adapter that communicates via Telegram Bot API.
 * Flow: sendMessage to the bot's chat -> poll getUpdates for the response.
 */
export class OpenClawTelegramAdapter extends BaseAdapter {
  readonly runtimeType = "openclaw-telegram" as const;
  private endpoint: OpenClawTelegramEndpoint;
  private lastUpdateId = 0;
  private abortController: AbortController | null = null;

  constructor(config: AgentRuntimeConfig) {
    super(config);
    this.endpoint = config.endpoint as OpenClawTelegramEndpoint;
  }

  async execute(task: TaskPayload): Promise<AdapterResult> {
    const start = Date.now();
    const prompt = this.formatPrompt(task);
    const timeout = this.endpoint.timeoutMs ?? 120_000;
    const partials: string[] = [];

    try {
      // Drain any pending updates first
      await this.drainUpdates();

      // Send the task prompt to the bot's chat
      await this.sendMessage(prompt);
      logger.info("Sent task to OpenClaw via Telegram", {
        chatId: this.endpoint.chatId,
        issueId: task.issueId,
      });

      // Poll for response
      const response = await this.pollForResponse(timeout, partials);
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
      logger.error("OpenClaw Telegram execution failed", {
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
      const url = `https://api.telegram.org/bot${this.endpoint.botToken}/getMe`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const data = (await res.json()) as { ok: boolean };
      const latencyMs = Date.now() - start;

      return {
        runtime: this.runtimeType,
        agent: this.config.agent,
        available: data.ok === true,
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
    logger.debug("OpenClaw Telegram adapter shut down", { agent: this.config.agent });
  }

  // ── Private helpers ──

  private async sendMessage(text: string): Promise<void> {
    // Telegram has a 4096 char limit per message. Chunk if needed.
    const chunks = this.chunkMessage(text, 4000);
    for (const chunk of chunks) {
      const url = `https://api.telegram.org/bot${this.endpoint.botToken}/sendMessage`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: this.endpoint.chatId,
          text: chunk,
          parse_mode: "Markdown",
        }),
        signal: AbortSignal.timeout(15_000),
      });

      const data = (await res.json()) as { ok: boolean; description?: string };
      if (!data.ok) {
        throw new Error(`Telegram sendMessage failed: ${data.description ?? "unknown"}`);
      }

      // Small delay between chunks
      if (chunks.length > 1) await this.sleep(500);
    }
  }

  private async drainUpdates(): Promise<void> {
    try {
      const url = `https://api.telegram.org/bot${this.endpoint.botToken}/getUpdates`;
      const params = new URLSearchParams({ offset: "-1", limit: "1" });
      const res = await fetch(`${url}?${params}`, { signal: AbortSignal.timeout(10_000) });
      const data = (await res.json()) as {
        ok: boolean;
        result: Array<{ update_id: number }>;
      };
      if (data.ok && data.result.length > 0) {
        this.lastUpdateId = data.result[data.result.length - 1]!.update_id + 1;
      }
    } catch {
      // Ignore drain errors
    }
  }

  private async pollForResponse(
    timeoutMs: number,
    partials: string[],
  ): Promise<string> {
    this.abortController = new AbortController();
    const deadline = Date.now() + timeoutMs;
    const collected: string[] = [];

    while (Date.now() < deadline) {
      if (this.abortController.signal.aborted) {
        throw new Error("Polling aborted");
      }

      try {
        const url = `https://api.telegram.org/bot${this.endpoint.botToken}/getUpdates`;
        const params = new URLSearchParams({
          offset: String(this.lastUpdateId),
          limit: "10",
          timeout: "5",
        });

        const res = await fetch(`${url}?${params}`, {
          signal: AbortSignal.timeout(15_000),
        });

        const data = (await res.json()) as {
          ok: boolean;
          result: Array<{
            update_id: number;
            message?: {
              chat: { id: number };
              text?: string;
              from?: { is_bot: boolean };
            };
          }>;
        };

        if (data.ok && data.result.length > 0) {
          for (const update of data.result) {
            this.lastUpdateId = update.update_id + 1;

            // Only accept messages from the target chat that are from a bot
            if (
              update.message?.chat.id === Number(this.endpoint.chatId) &&
              update.message?.text
            ) {
              const text = update.message.text;
              collected.push(text);
              partials.push(text);
              logger.debug("Received partial response from OpenClaw Telegram", {
                length: text.length,
              });
            }
          }

          // If we received at least one response and there's a pause, consider it done.
          // Wait for 3 more seconds to see if more messages come.
          if (collected.length > 0) {
            await this.sleep(3000);

            // Check for any additional messages
            const finalCheck = await fetch(
              `${url}?${new URLSearchParams({
                offset: String(this.lastUpdateId),
                limit: "10",
                timeout: "1",
              })}`,
              { signal: AbortSignal.timeout(10_000) },
            );

            const finalData = (await finalCheck.json()) as {
              ok: boolean;
              result: Array<{
                update_id: number;
                message?: { chat: { id: number }; text?: string };
              }>;
            };

            if (finalData.ok) {
              for (const update of finalData.result) {
                this.lastUpdateId = update.update_id + 1;
                if (
                  update.message?.chat.id === Number(this.endpoint.chatId) &&
                  update.message?.text
                ) {
                  collected.push(update.message.text);
                  partials.push(update.message.text);
                }
              }
            }

            return collected.join("\n\n");
          }
        }
      } catch (err) {
        if (this.abortController.signal.aborted) throw new Error("Polling aborted");
        logger.debug("Poll cycle error, retrying", {
          error: err instanceof Error ? err.message : String(err),
        });
        await this.sleep(2000);
      }
    }

    if (collected.length > 0) {
      return collected.join("\n\n");
    }

    throw new Error(`OpenClaw Telegram response timed out after ${timeoutMs}ms`);
  }

  private chunkMessage(text: string, maxLen: number): string[] {
    if (text.length <= maxLen) return [text];
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        break;
      }
      // Try to break at newline
      let breakIdx = remaining.lastIndexOf("\n", maxLen);
      if (breakIdx < maxLen * 0.5) breakIdx = maxLen;
      chunks.push(remaining.slice(0, breakIdx));
      remaining = remaining.slice(breakIdx).trimStart();
    }
    return chunks;
  }
}

// ── WebSocket Gateway Mode ──

/**
 * OpenClaw adapter that communicates via WebSocket gateway.
 * Connects to ws://host:port, sends JSON task, receives streamed response.
 */
export class OpenClawGatewayAdapter extends BaseAdapter {
  readonly runtimeType = "openclaw-gateway" as const;
  private endpoint: OpenClawGatewayEndpoint;
  private ws: WebSocket | null = null;

  constructor(config: AgentRuntimeConfig) {
    super(config);
    this.endpoint = config.endpoint as OpenClawGatewayEndpoint;
  }

  async execute(task: TaskPayload): Promise<AdapterResult> {
    const start = Date.now();
    const prompt = this.formatPrompt(task);
    const timeout = this.endpoint.timeoutMs ?? 120_000;
    const partials: string[] = [];

    try {
      const response = await this.sendViaWebSocket(prompt, task, timeout, partials);
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
      logger.error("OpenClaw Gateway execution failed", {
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
      const available = await new Promise<boolean>((resolve) => {
        const ws = new WebSocket(this.endpoint.wsUrl);
        const timer = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 10_000);

        ws.on("open", () => {
          clearTimeout(timer);
          // Send a ping/health message
          ws.send(JSON.stringify({ type: "ping" }));
          ws.close();
          resolve(true);
        });

        ws.on("error", () => {
          clearTimeout(timer);
          resolve(false);
        });
      });

      return {
        runtime: this.runtimeType,
        agent: this.config.agent,
        available,
        latencyMs: Date.now() - start,
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
    if (this.ws) {
      this.ws.close(1000, "Worker shutdown");
      this.ws = null;
    }
    logger.debug("OpenClaw Gateway adapter shut down", { agent: this.config.agent });
  }

  // ── Private helpers ──

  private sendViaWebSocket(
    prompt: string,
    task: TaskPayload,
    timeoutMs: number,
    partials: string[],
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.endpoint.wsUrl);
      this.ws = ws;

      const chunks: string[] = [];
      let completed = false;

      const timer = setTimeout(() => {
        if (!completed) {
          completed = true;
          ws.close();
          if (chunks.length > 0) {
            resolve(chunks.join(""));
          } else {
            reject(new Error(`OpenClaw Gateway timed out after ${timeoutMs}ms`));
          }
        }
      }, timeoutMs);

      ws.on("open", () => {
        logger.debug("Connected to OpenClaw Gateway", { url: this.endpoint.wsUrl });

        // Send the task in OpenClaw message format
        const message = {
          type: "task",
          id: task.issueId,
          agent: task.agentSlug,
          prompt,
          context: {
            title: task.context.title,
            project: task.context.projectId,
            priority: task.context.priority,
            labels: task.context.labels,
          },
        };

        ws.send(JSON.stringify(message));
      });

      ws.on("message", (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString()) as {
            type: string;
            content?: string;
            text?: string;
            error?: string;
            done?: boolean;
          };

          if (msg.type === "error") {
            completed = true;
            clearTimeout(timer);
            ws.close();
            reject(new Error(msg.error ?? "Unknown gateway error"));
            return;
          }

          // Accumulate response chunks
          const text = msg.content ?? msg.text ?? "";
          if (text) {
            chunks.push(text);
            partials.push(text);
            logger.debug("Received chunk from OpenClaw Gateway", {
              length: text.length,
            });
          }

          // Check if stream is complete
          if (msg.type === "done" || msg.type === "complete" || msg.done) {
            completed = true;
            clearTimeout(timer);
            ws.close();
            resolve(chunks.join(""));
          }
        } catch {
          // Non-JSON message, treat as plain text chunk
          const text = data.toString();
          if (text) {
            chunks.push(text);
            partials.push(text);
          }
        }
      });

      ws.on("close", () => {
        if (!completed) {
          completed = true;
          clearTimeout(timer);
          if (chunks.length > 0) {
            resolve(chunks.join(""));
          } else {
            reject(new Error("OpenClaw Gateway connection closed before response"));
          }
        }
        this.ws = null;
      });

      ws.on("error", (err: Error) => {
        if (!completed) {
          completed = true;
          clearTimeout(timer);
          reject(new Error(`OpenClaw Gateway WebSocket error: ${err.message}`));
        }
      });
    });
  }
}

/**
 * Factory: create the appropriate OpenClaw adapter based on endpoint type.
 */
export function createOpenClawAdapter(
  config: AgentRuntimeConfig,
): OpenClawTelegramAdapter | OpenClawGatewayAdapter {
  const endpointType = (config.endpoint as { type: string }).type;
  if (endpointType === "openclaw-telegram") {
    return new OpenClawTelegramAdapter(config);
  }
  return new OpenClawGatewayAdapter(config);
}
