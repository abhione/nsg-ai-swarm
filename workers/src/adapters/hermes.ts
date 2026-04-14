import type { PaperclipIssue, PaperclipAgent, AgentMapping, TaskResult } from '../types.js';
import { RuntimeAdapter } from './base.js';
import { log, debug, error as logError } from '../logger.js';

const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes

export class HermesAdapter extends RuntimeAdapter {
  readonly name = 'hermes';

  async execute(
    issue: PaperclipIssue,
    agent: PaperclipAgent,
    mapping: AgentMapping
  ): Promise<TaskResult> {
    switch (mapping.mode) {
      case 'api':
        return this.executeApi(issue, agent, mapping);
      case 'cli':
        return {
          success: false,
          output: '',
          error: 'CLI mode not yet supported',
          durationMs: 0,
        };
      default:
        return {
          success: false,
          output: '',
          error: `Unsupported Hermes mode: ${mapping.mode}`,
          durationMs: 0,
        };
    }
  }

  async healthCheck(mapping: AgentMapping): Promise<boolean> {
    if (mapping.mode !== 'api' || !mapping.endpoint) return false;

    try {
      const url = `${mapping.endpoint.replace(/\/+$/, '')}/api/health`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timer);
      return response.ok;
    } catch {
      return false;
    }
  }

  // ─── API Mode ─────────────────────────────────────────────────────

  private async executeApi(
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
        error: 'API mode requires an endpoint in agent mapping',
        durationMs: Date.now() - startTime,
      };
    }

    const prompt = this.buildPrompt(issue, agent);
    const apiUrl = `${endpoint.replace(/\/+$/, '')}/api/chat`;

    log(`[Hermes API] Sending task to ${apiUrl} for ${agent.name}`);

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const requestBody = {
        model: mapping.model ?? 'default',
        messages: [
          {
            role: 'system',
            content: `You are ${agent.name}, ${agent.title}. Your capabilities include: ${
              Array.isArray(agent.capabilities)
                ? agent.capabilities.join(', ')
                : String(agent.capabilities ?? 'general')
            }`,
          },
          {
            role: 'user',
            content: `Task: ${issue.title}\n\n${issue.description ?? '(no description)'}`,
          },
        ],
        stream: false,
      };

      debug(`[Hermes API] Request body: ${JSON.stringify(requestBody).substring(0, 200)}...`);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          output: '',
          error: `Hermes API returned ${response.status}: ${errorText}`,
          durationMs: Date.now() - startTime,
        };
      }

      const data = await response.json() as Record<string, unknown>;

      // Handle various response formats
      let output = '';
      if (typeof data.content === 'string') {
        output = data.content;
      } else if (typeof data.response === 'string') {
        output = data.response;
      } else if (typeof data.text === 'string') {
        output = data.text;
      } else if (data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
        const choice = data.choices[0] as Record<string, unknown>;
        if (choice.message && typeof (choice.message as Record<string, unknown>).content === 'string') {
          output = (choice.message as Record<string, unknown>).content as string;
        } else if (typeof choice.text === 'string') {
          output = choice.text;
        }
      } else if (typeof data.message === 'string') {
        output = data.message;
      } else {
        output = JSON.stringify(data);
      }

      log(`[Hermes API] Got response from ${agent.name} (${output.length} chars)`);

      return {
        success: true,
        output,
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      const error = err as Error;
      if (error.name === 'AbortError') {
        return {
          success: false,
          output: '',
          error: `Hermes API timeout after ${timeoutMs / 1000}s`,
          durationMs: Date.now() - startTime,
        };
      }

      logError(`[Hermes API] Request error: ${error.message}`);
      return {
        success: false,
        output: '',
        error: `Hermes API error: ${error.message}`,
        durationMs: Date.now() - startTime,
      };
    }
  }
}
