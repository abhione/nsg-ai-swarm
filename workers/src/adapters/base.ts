import type { PaperclipIssue, PaperclipAgent, AgentMapping, TaskResult } from '../types.js';

export abstract class RuntimeAdapter {
  abstract readonly name: string;

  /**
   * Execute a task for the given issue using the agent's runtime.
   */
  abstract execute(
    issue: PaperclipIssue,
    agent: PaperclipAgent,
    mapping: AgentMapping
  ): Promise<TaskResult>;

  /**
   * Check if the runtime is reachable for the given mapping.
   */
  abstract healthCheck(mapping: AgentMapping): Promise<boolean>;

  /**
   * Build a prompt string from the issue and agent context.
   */
  protected buildPrompt(issue: PaperclipIssue, agent: PaperclipAgent): string {
    const capabilities = Array.isArray(agent.capabilities)
      ? agent.capabilities.join(', ')
      : String(agent.capabilities ?? 'general');

    return [
      `You are ${agent.name}, ${agent.title}.`,
      `Capabilities: ${capabilities}`,
      '',
      `Task: ${issue.title}`,
      '',
      issue.description ?? '(no description provided)',
    ].join('\n');
  }

  /**
   * Create a nicely formatted task message for chat-based runtimes.
   */
  protected formatTaskMessage(issue: PaperclipIssue, agent: PaperclipAgent): string {
    const capabilities = Array.isArray(agent.capabilities)
      ? agent.capabilities.join(', ')
      : String(agent.capabilities ?? 'general');

    return [
      `📋 New Task Assignment`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `👤 Agent: ${agent.name} (${agent.title})`,
      `🔧 Capabilities: ${capabilities}`,
      ``,
      `📌 Issue: ${issue.title}`,
      `🔴 Priority: ${issue.priority ?? 'normal'}`,
      ``,
      `📝 Description:`,
      issue.description ?? '(no description provided)',
      ``,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `Please complete this task and provide your response.`,
    ].join('\n');
  }
}
