import chalk from 'chalk';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const LEVEL_COLORS: Record<LogLevel, (s: string) => string> = {
  info: chalk.blue,
  warn: chalk.yellow,
  error: chalk.red,
  debug: chalk.gray,
};

const LEVEL_LABELS: Record<LogLevel, string> = {
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
  debug: 'DEBUG',
};

let debugEnabled = false;

export function enableDebug(enabled: boolean): void {
  debugEnabled = enabled;
}

function timestamp(): string {
  return chalk.dim(new Date().toISOString().replace('T', ' ').replace('Z', ''));
}

function formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
  const ts = timestamp();
  const tag = LEVEL_COLORS[level](`[${LEVEL_LABELS[level]}]`);
  const extra = args.length > 0
    ? ' ' + args.map(a => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' ')
    : '';
  return `${ts} ${tag} ${message}${extra}`;
}

export function log(message: string, ...args: unknown[]): void {
  console.log(formatMessage('info', message, ...args));
}

export function warn(message: string, ...args: unknown[]): void {
  console.warn(formatMessage('warn', message, ...args));
}

export function error(message: string, ...args: unknown[]): void {
  console.error(formatMessage('error', message, ...args));
}

export function debug(message: string, ...args: unknown[]): void {
  if (!debugEnabled) return;
  console.log(formatMessage('debug', message, ...args));
}
