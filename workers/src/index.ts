#!/usr/bin/env node
// ── Entry point: CLI arg parsing, banner, startup ──

import { Command } from "commander";
import chalk from "chalk";
import { loadConfig, ConfigError } from "./config.js";
import { Orchestrator } from "./orchestrator.js";
import { setLogLevel } from "./logger.js";
import logger from "./logger.js";

const VERSION = "0.1.0";

function printBanner(): void {
  console.log(
    chalk.cyan(`
╔══════════════════════════════════════════╗
║                                          ║
║   ${chalk.bold("NSG AI Swarm Worker")}                   ║
║   ${chalk.dim(`v${VERSION}`)}                               ║
║                                          ║
║   Orchestrator for OpenClaw & Hermes     ║
║   Bridging Paperclip → Agent Runtimes    ║
║                                          ║
╚══════════════════════════════════════════╝
`),
  );
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("nsg-worker")
    .description("NSG AI Swarm Worker — Paperclip-to-runtime orchestrator")
    .version(VERSION);

  program
    .command("start")
    .description("Start the orchestrator worker")
    .requiredOption("-c, --config <path>", "Path to config YAML file")
    .option("-l, --log-level <level>", "Log level: debug, info, warn, error")
    .action(async (opts: { config: string; logLevel?: string }) => {
      printBanner();

      try {
        // Load config
        const config = loadConfig(opts.config);

        // Override log level from CLI if provided
        const logLevel = opts.logLevel ?? config.logLevel;
        setLogLevel(logLevel as "debug" | "info" | "warn" | "error");

        logger.info("Config loaded", {
          paperclipUrl: config.paperclip.baseUrl,
          companyId: config.paperclip.companyId,
          agents: config.agents.length,
          pollIntervalMs: config.pollIntervalMs,
        });

        // Create orchestrator
        const orchestrator = new Orchestrator(config);

        // Graceful shutdown handlers
        const shutdown = async (signal: string) => {
          logger.info(`Received ${signal}, shutting down gracefully...`);
          await orchestrator.stop();
          process.exit(0);
        };

        process.on("SIGINT", () => void shutdown("SIGINT"));
        process.on("SIGTERM", () => void shutdown("SIGTERM"));
        process.on("uncaughtException", (err) => {
          logger.error("Uncaught exception", { error: err.message, stack: err.stack });
          void shutdown("uncaughtException");
        });
        process.on("unhandledRejection", (reason) => {
          logger.error("Unhandled rejection", {
            error: reason instanceof Error ? reason.message : String(reason),
          });
        });

        // Initialize and start
        await orchestrator.initialize();
        await orchestrator.start();
      } catch (err) {
        if (err instanceof ConfigError) {
          logger.error(`Configuration error: ${err.message}`);
        } else {
          logger.error("Fatal startup error", {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          });
        }
        process.exit(1);
      }
    });

  program
    .command("health")
    .description("Check health of all configured runtimes")
    .requiredOption("-c, --config <path>", "Path to config YAML file")
    .action(async (opts: { config: string }) => {
      printBanner();

      try {
        const config = loadConfig(opts.config);
        setLogLevel(config.logLevel);

        const orchestrator = new Orchestrator(config);
        await orchestrator.initialize();
        const results = await orchestrator.runHealthChecks();

        console.log("");
        console.log(chalk.bold("Runtime Health Check Results:"));
        console.log("─".repeat(50));

        for (const r of results) {
          const status = r.available
            ? chalk.green("✓ AVAILABLE")
            : chalk.red("✗ UNAVAILABLE");
          const latency = r.latencyMs ? chalk.dim(`${r.latencyMs}ms`) : "";
          const error = r.error ? chalk.red(` (${r.error})`) : "";
          console.log(
            `  ${status} ${chalk.bold(r.agent)} [${r.runtime}] ${latency}${error}`,
          );
        }

        console.log("");
        await orchestrator.stop();
      } catch (err) {
        if (err instanceof ConfigError) {
          logger.error(`Configuration error: ${err.message}`);
        } else {
          logger.error("Health check failed", {
            error: err instanceof Error ? err.message : String(err),
          });
        }
        process.exit(1);
      }
    });

  program
    .command("validate")
    .description("Validate configuration file")
    .requiredOption("-c, --config <path>", "Path to config YAML file")
    .action((opts: { config: string }) => {
      try {
        const config = loadConfig(opts.config);
        console.log(chalk.green("✓ Configuration is valid"));
        console.log(chalk.dim(`  Paperclip: ${config.paperclip.baseUrl}`));
        console.log(chalk.dim(`  Company:   ${config.paperclip.companyId}`));
        console.log(chalk.dim(`  Agents:    ${config.agents.length}`));
        for (const a of config.agents) {
          console.log(chalk.dim(`    → ${a.agent} [${a.runtime}]`));
        }
      } catch (err) {
        if (err instanceof ConfigError) {
          console.log(chalk.red(`✗ Configuration error: ${err.message}`));
        } else {
          console.log(
            chalk.red(`✗ Error: ${err instanceof Error ? err.message : String(err)}`),
          );
        }
        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
