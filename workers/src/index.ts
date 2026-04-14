import chalk from 'chalk';
import { loadConfig } from './config.js';
import { PaperclipClient } from './paperclip/client.js';
import { OpenClawAdapter } from './adapters/openclaw.js';
import { HermesAdapter } from './adapters/hermes.js';
import { RuntimeAdapter } from './adapters/base.js';
import { Orchestrator } from './orchestrator.js';
import { log, error as logError, enableDebug } from './logger.js';

// ─── CLI Argument Parsing ───────────────────────────────────────────

function parseArgs(): { configPath?: string; dryRun: boolean; debugMode: boolean; help: boolean } {
  const args = process.argv.slice(2);
  let configPath: string | undefined;
  let dryRun = false;
  let debugMode = false;
  let help = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--config':
      case '-c':
        configPath = args[++i];
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--debug':
      case '-d':
        debugMode = true;
        break;
      case '--help':
      case '-h':
        help = true;
        break;
    }
  }

  return { configPath, dryRun, debugMode, help };
}

// ─── Startup Banner ─────────────────────────────────────────────────

function printBanner(dryRun: boolean): void {
  const banner = `
${chalk.cyan('╔══════════════════════════════════════════════════╗')}
${chalk.cyan('║')}  ${chalk.bold.white('🐝  NSG Swarm Workers')}                             ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.dim('Paperclip ↔ AI Runtime Orchestrator')}              ${chalk.cyan('║')}
${chalk.cyan('╚══════════════════════════════════════════════════╝')}`;

  console.log(banner);
  if (dryRun) {
    console.log(chalk.yellow('\n  ⚠️  DRY-RUN MODE — no mutations will be made\n'));
  }
}

function printHelp(): void {
  console.log(`
Usage: swarm-workers [options]

Options:
  --config, -c <path>   Path to YAML config file (default: config.yaml or WORKER_CONFIG env)
  --dry-run             Run without making changes to Paperclip
  --debug, -d           Enable debug logging
  --help, -h            Show this help message

Environment:
  WORKER_CONFIG         Path to config file (overridden by --config)

Examples:
  npx tsx src/index.ts --config config.yaml
  npx tsx src/index.ts --config config.yaml --dry-run --debug
  WORKER_CONFIG=./config.yaml node dist/index.js
`);
}

// ─── Main ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { configPath, dryRun, debugMode, help } = parseArgs();

  if (help) {
    printHelp();
    process.exit(0);
  }

  if (debugMode) {
    enableDebug(true);
  }

  printBanner(dryRun);

  // Load configuration
  log('Loading configuration...');
  let config;
  try {
    config = loadConfig(configPath);
  } catch (err) {
    logError(`Failed to load config: ${(err as Error).message}`);
    process.exit(1);
  }
  log(`Config loaded: ${config.agents.length} agent(s), polling every ${config.polling.intervalMs / 1000}s`);

  // Print agent summary
  for (const agent of config.agents) {
    log(`  → ${chalk.bold(agent.name)} [${agent.runtime}/${agent.mode}]${agent.endpoint ? ` @ ${agent.endpoint}` : ''}${agent.botToken ? ' (Telegram)' : ''}`);
  }

  // Create Paperclip client
  log(`Connecting to Paperclip at ${config.paperclip.url}...`);
  const client = new PaperclipClient(config.paperclip.url);

  // Verify connectivity
  try {
    const companies = await client.getCompanies();
    log(`Paperclip connected — ${companies.length} company/ies available`);
  } catch (err) {
    logError(`Cannot reach Paperclip API at ${config.paperclip.url}: ${(err as Error).message}`);
    process.exit(1);
  }

  // Create adapters
  const adapters = new Map<string, RuntimeAdapter>();
  adapters.set('openclaw', new OpenClawAdapter());
  adapters.set('hermes', new HermesAdapter());
  log(`Registered adapters: ${[...adapters.keys()].join(', ')}`);

  // Create and start orchestrator
  const orchestrator = new Orchestrator(config, client, adapters, dryRun);

  try {
    await orchestrator.start();
  } catch (err) {
    logError(`Orchestrator failed to start: ${(err as Error).message}`);
    process.exit(1);
  }
}

// Run
main().catch((err) => {
  logError(`Fatal error: ${(err as Error).message}`);
  console.error(err);
  process.exit(1);
});
