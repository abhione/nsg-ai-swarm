import WebSocket from 'ws';
import type { PaperclipIssue, PaperclipAgent, AgentMapping, TaskResult } from '../types.js';
import { RuntimeAdapter } from './base.js';
import { log, warn, debug, error as logError } from '../logger.js';

const TELEGRAM_API = 'https://api.telegram.org';
const TELEGRAM_POLL_INTERVAL_MS = 3000;
const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes

export class OpenClawAdapter extends RuntimeAdapter {
  readonly name = 'openclaw';

  async execute(
    issue: PaperclipIssue,
    agent: PaperclipAgent,
    mapping: AgentMapping
  ): Promise<TaskResult> {
    switch (mapping.mode) {
      case 'telegram':
        return this.executeTelegram(issue, agent, mapping);
      case 'gateway':
        return this.executeGateway(issue, agent, mapping);
      default:
        return {
          success: false,
          output: '',
          error: `Unsupported OpenClaw mode: ${mapping.mode}`,
          durationMs: 0,
        };
    }
  }

  async healthCheck(mapping: AgentMapping): Promise<boolean> {
    try {
      switch (mapping.mode) {
        case 'telegram':
          return await this.checkTelegramHealth(mapping);
        case 'gateway':
          return await this.checkGatewayHealth(mapping);
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  // ─── Telegram Mode ────────────────────────────────────────────────

  private async executeTelegram(
    issue: PaperclipIssue,
    agent: PaperclipAgent,
    mapping: AgentMapping
  ): Promise<TaskResult> {
    const startTime = Date.now();
    const timeoutMs = mapping.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    if (!mapping.botToken || !mapping.chatId) {
      return {
        success: false,
        output: '',
        error: 'Telegram mode requires botToken and chatId in agent mapping',
        durationMs: Date.now() - startTime,
      };
    }

    const message = this.formatTaskMessage(issue, agent);

    try {
      // Step 1: Get the latest update_id so we know where to start polling
      const lastUpdateId = await this.getLatestUpdateId(mapping.botToken);

      // Step 2: Send the task message
      log(`[Telegram] Sending task to chat ${mapping.chatId} for ${agent.name}`);
      const sendResult = await this.telegramRequest(mapping.botToken, 'sendMessage', {
        chat_id: mapping.chatId,
        text: message,
        parse_mode: undefined, // plain text to avoid formatting issues
      });

      if (!sendResult.ok) {
        return {
          success: false,
          output: '',
          error: `Telegram sendMessage failed: ${JSON.stringify(sendResult)}`,
          durationMs: Date.now() - startTime,
        };
      }

      const sentMessageId = sendResult.result?.message_id;
      debug(`[Telegram] Message sent (id: ${sentMessageId}), polling for reply...`);

      // Step 3: Poll for a reply
      const reply = await this.pollForReply(
        mapping.botToken,
        mapping.chatId,
        lastUpdateId,
        sentMessageId,
        timeoutMs,
        startTime
      );

      if (reply) {
        log(`[Telegram] Got reply from ${agent.name} (${reply.length} chars)`);
        return {
          success: true,
          output: reply,
          durationMs: Date.now() - startTime,
        };
      }

      return {
        success: false,
        output: '',
        error: `Timeout waiting for Telegram reply after ${timeoutMs / 1000}s`,
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        output: '',
        error: `Telegram execution error: ${(err as Error).message}`,
        durationMs: Date.now() - startTime,
      };
    }
  }

  private async getLatestUpdateId(botToken: string): Promise<number> {
    try {
      const result = await this.telegramRequest(botToken, 'getUpdates', {
        offset: -1,
        limit: 1,
      });
      if (result.ok && result.result?.length > 0) {
        return result.result[result.result.length - 1].update_id;
      }
    } catch {
      // Ignore — start from 0
    }
    return 0;
  }

  private async pollForReply(
    botToken: string,
    chatId: string,
    lastUpdateId: number,
    sentMessageId: number | undefined,
    timeoutMs: number,
    startTime: number
  ): Promise<string | null> {
    let offset = lastUpdateId + 1;
    const deadline = startTime + timeoutMs;

    while (Date.now() < deadline) {
      try {
        const result = await this.telegramRequest(botToken, 'getUpdates', {
          offset,
          limit: 100,
          timeout: Math.min(30, Math.floor((deadline - Date.now()) / 1000)),
        });

        if (result.ok && Array.isArray(result.result)) {
          for (const update of result.result) {
            // Advance offset past this update
            offset = update.update_id + 1;

            const msg = update.message;
            if (!msg) continue;

            // Must be from the same chat
            if (String(msg.chat?.id) !== String(chatId)) continue;

            // Must be after our sent message
            if (sentMessageId && msg.message_id <= sentMessageId) continue;

            // Must be a text message (the reply)
            if (msg.text) {
              return msg.text;
            }
          }
        }
      } catch (err) {
        warn(`[Telegram] Poll error: ${(err as Error).message}`);
      }

      // Short sleep before next poll
      await this.sleep(TELEGRAM_POLL_INTERVAL_MS);
    }

    return null;
  }

  private async telegramRequest(
    botToken: string,
    method: string,
    params: Record<string, unknown>
  ): Promise<{ ok: boolean; result?: any; description?: string }> {
    const url = `${TELEGRAM_API}/bot${botToken}/${method}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return response.json() as Promise<{ ok: boolean; result?: any; description?: string }>;
  }

  private async checkTelegramHealth(mapping: AgentMapping): Promise<boolean> {
    if (!mapping.botToken) return false;
    try {
      const result = await this.telegramRequest(mapping.botToken, 'getMe', {});
      return result.ok === true;
    } catch {
      return false;
    }
  }

  // ─── Gateway (WebSocket) Mode ─────────────────────────────────────

  private async executeGateway(
    issue: PaperclipIssue,
    agent: PaperclipAgent,
    mapping: AgentMapping
  ): Promise<TaskResult> {
    const startTime = Date.now();
    const timeoutMs = mapping.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const endpoint = mapping.endpoint;

    if (!endpoint) {
      return {
        success: false,
        output: '',
        error: 'Gateway mode requires an endpoint in agent mapping',
        durationMs: Date.now() - startTime,
      };
    }

    const prompt = this.buildPrompt(issue, agent);

    return new Promise<TaskResult>((resolve) => {
      let resolved = false;
      let responseChunks: string[] = [];
      let ws: WebSocket | null = null;

      const cleanup = () => {
        if (ws) {
          try {
            ws.close();
          } catch {
            // ignore
          }
          ws = null;
        }
      };

      const finish = (result: TaskResult) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(result);
      };

      // Timeout handler
      const timer = setTimeout(() => {
        const partial = responseChunks.join('');
        finish({
          success: partial.length > 0,
          output: partial || '',
          error: partial.length > 0 ? undefined : `Gateway timeout after ${timeoutMs / 1000}s`,
          durationMs: Date.now() - startTime,
        });
      }, timeoutMs);

      try {
        log(`[Gateway] Connecting to ${endpoint} for ${agent.name}`);
        ws = new WebSocket(endpoint);

        ws.on('open', () => {
          debug(`[Gateway] Connected to ${endpoint}`);
          // Send the task as a JSON message
          const payload = JSON.stringify({
            type: 'task',
            prompt,
            agent: agent.name,
            issueId: issue.id,
            issueTitle: issue.title,
          });
          ws!.send(payload);
          debug(`[Gateway] Task sent (${payload.length} bytes)`);
        });

        ws.on('message', (data: WebSocket.Data) => {
          const text = data.toString();
          debug(`[Gateway] Received chunk (${text.length} chars)`);

          try {
            // Try to parse as JSON response
            const parsed = JSON.parse(text);
            if (parsed.type === 'response' || parsed.type === 'complete') {
              const content = parsed.content || parsed.text || parsed.output || text;
              clearTimeout(timer);
              finish({
                success: true,
                output: content,
                durationMs: Date.now() - startTime,
              });
              return;
            }
            if (parsed.type === 'error') {
              clearTimeout(timer);
              finish({
                success: false,
                output: '',
                error: parsed.message || parsed.error || 'Gateway returned error',
                durationMs: Date.now() - startTime,
              });
              return;
            }
            if (parsed.type === 'chunk' || parsed.type === 'stream') {
              responseChunks.push(parsed.content || parsed.text || '');
              return;
            }
          } catch {
            // Not JSON — treat as raw text response
          }

          // Raw text: accumulate or treat as complete response
          responseChunks.push(text);
        });

        ws.on('close', (code, reason) => {
          debug(`[Gateway] Connection closed (code: ${code}, reason: ${reason?.toString() || 'none'})`);
          clearTimeout(timer);
          const output = responseChunks.join('');
          finish({
            success: output.length > 0,
            output,
            error: output.length === 0 ? `Gateway closed without response (code: ${code})` : undefined,
            durationMs: Date.now() - startTime,
          });
        });

        ws.on('error', (err: Error) => {
          logError(`[Gateway] WebSocket error: ${err.message}`);
          clearTimeout(timer);
          finish({
            success: false,
            output: responseChunks.join(''),
            error: `Gateway WebSocket error: ${err.message}`,
            durationMs: Date.now() - startTime,
          });
        });
      } catch (err) {
        clearTimeout(timer);
        finish({
          success: false,
          output: '',
          error: `Gateway connection error: ${(err as Error).message}`,
          durationMs: Date.now() - startTime,
        });
      }
    });
  }

  private async checkGatewayHealth(mapping: AgentMapping): Promise<boolean> {
    if (!mapping.endpoint) return false;

    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        resolve(false);
      }, 5000);

      try {
        const ws = new WebSocket(mapping.endpoint!);
        ws.on('open', () => {
          clearTimeout(timer);
          ws.close();
          resolve(true);
        });
        ws.on('error', () => {
          clearTimeout(timer);
          resolve(false);
        });
      } catch {
        clearTimeout(timer);
        resolve(false);
      }
    });
  }

  // ─── Utility ──────────────────────────────────────────────────────

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
