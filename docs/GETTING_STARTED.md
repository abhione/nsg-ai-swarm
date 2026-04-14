# Getting Started with NSG AI Swarm

This guide walks you through setting up the full NSG AI Swarm — from a fresh clone to 12 agents executing marketing tasks for vision care practices.

Total time: ~30 minutes for local dev, ~1 hour for production deployment.

---

## Prerequisites

Before starting, you need:

- **Node.js 18+** and **pnpm 9.15+** — Paperclip is a Node.js monorepo
- **Docker** (optional) — only needed if you want to use external Postgres instead of the embedded PGlite
- **At least one AI runtime** — either OpenClaw or Hermes agent instance
- **API credentials for your runtime**:
  - OpenClaw: AWS Bedrock access (IAM credentials) or Anthropic API key
  - Hermes: Anthropic API key or compatible LLM provider
- **curl and python3** — used by the setup script to seed agents via the API

Check your versions:

```bash
node --version    # v18.0.0 or higher
pnpm --version    # 9.15.0 or higher
python3 --version # any 3.x
```

---

## Step 1: Clone & Install

```bash
git clone https://github.com/abhione/nsg-ai-swarm.git
cd nsg-ai-swarm
pnpm install
```

This installs all workspace packages: the API server, React UI, database layer, agent adapters, and shared types. Takes 2-3 minutes on a fresh install.

---

## Step 2: Start Paperclip

### Configure Environment

```bash
cp .env.example .env
```

The `.env.example` has sensible defaults. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | _(empty)_ | Leave empty to use embedded PGlite (zero-config). Set to a Postgres connection string for production. |
| `PORT` | `3100` | API server port |
| `SERVE_UI` | `false` | Set to `true` if you want the UI served by the API server (production). In dev mode, Vite handles this automatically. |

For local development, the defaults work out of the box. No database setup required — Paperclip uses an embedded PGlite database stored in `data/pglite/`.

### Start the Dev Server

```bash
pnpm dev
```

This starts:
- API server at `http://localhost:3100`
- React UI at `http://localhost:3100` (served via Vite dev middleware)

### Complete Onboarding

Open `http://localhost:3100` in your browser. The onboarding wizard will prompt you to:

1. Create an admin account (email + password)
2. Name your Paperclip instance

Once onboarding completes, you'll see an empty dashboard. That's expected — the next step populates it.

### Verify the Server

```bash
curl http://localhost:3100/api/health
# Should return {"status":"ok"}
```

---

## Step 3: Seed the NSG AI Swarm

With Paperclip running on port 3100, open a new terminal:

```bash
bash setup-nsg.sh
```

This script makes ~35 API calls to create the full NSG org structure. It takes about 10 seconds.

### What Gets Created

**Company:** NSG AI Operations ($500/month budget)

**12 Agents in 3 departments + 1 cross-functional:**

Executive:
- **Atlas** — Chief AI Officer (CEO). Heartbeat every 4 hours. Breaks company goals into departmental objectives.

Client Intelligence (reports to Atlas via Athena):
- **Athena** — VP Client Intelligence. Owns client profile platform.
- **Scout** — Client Profiler. Scrapes websites, extracts services/staff/locations into structured JSON.
- **Echo** — Transcript Analyst. Processes call recordings, extracts pain points and action items.

Campaign Operations (reports to Atlas via Apollo):
- **Apollo** — VP Campaign Operations. Owns campaign pipeline from strategy to deployment.
- **Muse** — Campaign Strategist. Generates quarterly plans with channel strategies and KPI targets.
- **Quill** — Content Generator. Creates emails, social posts, GBP posts, SMS, landing pages.

Analytics & Reporting (reports to Atlas via Oracle):
- **Oracle** — VP Analytics & Reporting. Owns data aggregation and performance monitoring.
- **Flux** — Data Aggregator. Pulls from Google Analytics, SEMrush, BrightLocal, Patient Engage. Heartbeat every hour.
- **Sentinel** — Alert Monitor. Detects ranking drops, traffic anomalies, conversion changes. Heartbeat every hour.
- **Compass** — SEO Auditor. Runs 15-point audits: technical SEO, local SEO, backlinks, Core Web Vitals.

Cross-Functional (reports directly to Atlas):
- **Relay** — Meeting Assistant. Pre-call briefs, post-call processing, follow-up drafts.

**5 Goals (hierarchical):**
1. *Automate Q2 campaign cycle for pilot practices* (company-level, owned by Atlas)
2. *Build comprehensive intelligence profiles for 3 pilot practices* (team-level, owned by Athena)
3. *Generate and deploy Q2 campaigns for 3 pilot practices* (team-level, owned by Apollo)
4. *Establish baseline metrics and monitoring for pilot practices* (team-level, owned by Oracle)
5. *Demonstrate 30% time savings on meeting prep* (team-level, owned by Relay)

**16 Pilot Tasks** assigned across all agents — from scraping specific practice websites to configuring alert rules. All start in `backlog` status.

After the script completes, refresh the Paperclip dashboard. You'll see the full org chart, all agents, goals, and tasks.

---

## Step 4: Set Up AI Agent Runtimes

The agents in Paperclip are just records — names, titles, capabilities. To make them actually work, you need AI runtimes that can receive tasks and execute them. The workers module bridges the gap.

Two runtimes are supported:

### Option A: OpenClaw

OpenClaw is the primary runtime for NSG. It provides a gateway API and optional Telegram bot integration for async task delivery.

**Install:**

```bash
npm install -g openclaw
```

**Configure credentials:**

OpenClaw needs access to an LLM provider. Configure via environment:

```bash
# For AWS Bedrock (recommended for production)
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
export AWS_REGION=us-east-1

# OR for Anthropic direct
export ANTHROPIC_API_KEY=sk-ant-...
```

**Start the gateway:**

```bash
openclaw gateway run
```

The gateway starts on port `18789` by default. This is a WebSocket API that the workers connect to for dispatching tasks.

**Telegram bot setup (recommended):**

For async tasks and human-in-the-loop workflows, set up Telegram bots:

1. Talk to [@BotFather](https://t.me/BotFather) on Telegram
2. Create a new bot for each agent (or reuse one bot with different chat contexts)
3. Note the bot token and the chat ID where it should send messages
4. Add these to your worker config (Step 5)

Telegram mode is especially useful for agents like Relay (meeting assistant) where a human strategist needs to review output before it's finalized.

### Option B: Hermes

Hermes is the Nous Research agent runtime. It exposes an HTTP API.

**Install and start:**

```bash
# Install Hermes (check https://github.com/NousResearch/hermes for latest)
npm install -g hermes-agent

# Configure
export ANTHROPIC_API_KEY=sk-ant-...

# Start the API server
hermes serve --port 8642
```

The Hermes API accepts task payloads at `POST http://localhost:8642/v1/tasks`.

**Choose your model:**

Hermes supports multiple model backends. Configure per-agent in the worker config if you want different models for different agents (e.g., a cheaper model for Scout's web scraping, a stronger model for Muse's campaign strategy).

---

## Step 5: Connect Workers (Orchestrator)

The workers module is the bridge between Paperclip (where tasks live) and AI runtimes (where tasks get executed).

```bash
cd workers
npm install
```

### Create Configuration

```bash
cp config.example.yaml config.yaml
```

Edit `config.yaml` to map each agent to its runtime. Here's a complete example for the NSG swarm:

```yaml
# ============================================================================
# NSG AI Swarm — Worker Configuration
# ============================================================================

# Connection to Paperclip control plane
paperclip:
  url: "http://localhost:3100"
  companySlug: "nsg-ai-operations"
  apiKey: "${PAPERCLIP_API_KEY}"    # Optional: board-level API key

# How often to poll for new tasks
polling:
  intervalMs: 30000                  # Check every 30 seconds
  maxConcurrentTasks: 3              # Max tasks running simultaneously

# Default settings (applied to agents that don't override)
defaults:
  runtime: openclaw
  mode: telegram
  timeout: 300000                    # 5 minutes per task

# Agent-to-runtime mappings
agents:
  # === Executive ===
  - name: Atlas
    runtime: openclaw
    mode: telegram
    botToken: "${ATLAS_BOT_TOKEN}"
    chatId: "${ATLAS_CHAT_ID}"
    timeout: 600000                  # 10 min — CEO tasks are complex

  # === Client Intelligence ===
  - name: Athena
    runtime: openclaw
    mode: telegram
    botToken: "${ATHENA_BOT_TOKEN}"
    chatId: "${ATHENA_CHAT_ID}"

  - name: Scout
    runtime: openclaw
    mode: gateway
    endpoint: "ws://localhost:18789"
    timeout: 180000                  # 3 min — web scraping is fast

  - name: Echo
    runtime: openclaw
    mode: gateway
    endpoint: "ws://localhost:18789"
    timeout: 300000

  # === Campaign Operations ===
  - name: Apollo
    runtime: openclaw
    mode: telegram
    botToken: "${APOLLO_BOT_TOKEN}"
    chatId: "${APOLLO_CHAT_ID}"

  - name: Muse
    runtime: hermes
    mode: api
    endpoint: "http://localhost:8642"
    model: "claude-sonnet-4-20250514"
    timeout: 600000                  # 10 min — strategy generation is heavy

  - name: Quill
    runtime: hermes
    mode: api
    endpoint: "http://localhost:8642"
    model: "claude-sonnet-4-20250514"

  # === Analytics & Reporting ===
  - name: Oracle
    runtime: openclaw
    mode: telegram
    botToken: "${ORACLE_BOT_TOKEN}"
    chatId: "${ORACLE_CHAT_ID}"

  - name: Flux
    runtime: openclaw
    mode: gateway
    endpoint: "ws://localhost:18789"
    maxConcurrent: 2                 # Flux can handle parallel data pulls

  - name: Sentinel
    runtime: openclaw
    mode: gateway
    endpoint: "ws://localhost:18789"

  - name: Compass
    runtime: openclaw
    mode: gateway
    endpoint: "ws://localhost:18789"
    timeout: 600000                  # SEO audits are slow

  # === Cross-Functional ===
  - name: Relay
    runtime: openclaw
    mode: telegram
    botToken: "${RELAY_BOT_TOKEN}"
    chatId: "${RELAY_CHAT_ID}"
```

### Environment Variables

The config supports `${VAR_NAME}` interpolation with optional defaults via `${VAR_NAME:-default}`. Set your secrets in the environment or a `.env` file:

```bash
export PAPERCLIP_API_KEY=your-board-api-key
export ATLAS_BOT_TOKEN=123456:ABC-DEF...
export ATLAS_CHAT_ID=987654321
# ... repeat for each Telegram-connected agent
```

### Start the Workers

```bash
npm run dev
```

You should see output like:

```
[config] Loading config from /path/to/config.yaml
[config] Config loaded successfully { company: 'nsg-ai-operations', agents: 12, pollInterval: '30000ms' }
[poller] Connected to Paperclip at http://localhost:3100
[poller] Resolved 12 agent mappings
[poller] Polling for tasks...
```

### CLI Options

```bash
npm run dev -- --config /path/to/custom-config.yaml   # Custom config path
npm run dev -- --dry-run                                # Poll but don't dispatch
npm run dev -- --verbose                                # Debug logging
```

---

## Step 6: Verify It's Working

### Check the Dashboard

Open `http://localhost:3100`. You should see:

1. **Org chart** — Atlas at the top, three VPs below, specialists under each VP
2. **12 agents** — all showing in the agent list
3. **16 tasks** — in the backlog, assigned to their respective agents
4. **5 goals** — with the hierarchy visible (company goal → team goals)

### Test a Task

1. In the Paperclip UI, find a task (e.g., "Scrape & Profile: Levin Eye Care")
2. Change its status from `backlog` to `todo`
3. Watch the worker logs — within 30 seconds (one poll cycle), you should see:

```
[poller] Found 1 actionable task(s)
[dispatcher] Dispatching "Scrape & Profile: Levin Eye Care" to Scout via openclaw/gateway
[dispatcher] Task completed in 45.2s
[reporter] Updated issue status to in_review
```

4. If the agent uses Telegram mode, check the bot's chat — the task should appear as a message

### Verify Agent Communication

For gateway-mode agents, check that the OpenClaw gateway is receiving connections:

```bash
# In the OpenClaw gateway logs, you should see:
# [gateway] New WebSocket connection from workers
# [gateway] Task received: "Scrape & Profile: Levin Eye Care"
```

For Telegram-mode agents, verify the bot is sending messages to the configured chat.

---

## Architecture

```
Paperclip (Control Plane)       Workers (Orchestrator)       AI Runtimes
┌───────────────────────┐      ┌────────────────────┐      ┌──────────────────┐
│                       │      │                    │      │  OpenClaw         │
│  React Dashboard      │      │  Config Loader     │      │   - Gateway API  │
│  REST API (port 3100) │◄────►│  Poller            │      │     (WS:18789)   │
│  Agent Management     │ REST │  Dispatcher        │─────►│   - Telegram Bot │
│  Issue/Task Tracker   │ API  │  Result Reporter   │      │                  │
│  Goal Hierarchy       │      │                    │      ├──────────────────┤
│  Budget Enforcement   │      └────────────────────┘      │  Hermes          │
│  Org Chart            │                                  │   - REST API     │
│  Audit Log            │                                  │     (HTTP:8642)  │
│  Embedded PGlite      │                                  │   - CLI          │
└───────────────────────┘                                  └──────────────────┘
```

### Data Flow

1. **Setup:** `setup-nsg.sh` creates company, agents, goals, and tasks via Paperclip's REST API
2. **Polling:** Workers check Paperclip every N seconds for tasks in `todo` status assigned to mapped agents
3. **Dispatch:** When a task is found, the worker marks it `in_progress` and sends it to the agent's configured runtime
4. **Execution:** The AI runtime (OpenClaw/Hermes) processes the task using its LLM, tools, and context
5. **Reporting:** The worker posts the result back to Paperclip as a comment and updates the task status
6. **Governance:** VPs and Atlas review completed work via heartbeats. Humans can intervene at any point.

### Why This Architecture

Paperclip doesn't need to know about LLMs, API keys, or model configs. It just manages the org.
Workers don't need to know about org charts or budgets. They just bridge tasks to runtimes.
Runtimes don't need to know about Paperclip. They just execute what they receive.

Clean separation. Each piece can be replaced independently.

---

## The 12 Agents

| # | Name | Title | Department | Role | Heartbeat | What They Do |
|---|------|-------|------------|------|-----------|--------------|
| 1 | **Atlas** | Chief AI Officer | Executive | CEO | 4h | Decomposes company goals into department objectives. Reviews cross-department dependencies. Escalates to the Board (you). |
| 2 | **Athena** | VP Client Intelligence | Client Intelligence | CMO | 2h | Manages the client intelligence platform. Ensures every strategist has instant access to comprehensive profiles for all 1,000+ practices. |
| 3 | **Scout** | Client Profiler | Client Intelligence | Researcher | 2h | Scrapes practice websites, social media, public data. Outputs structured JSON profiles: services, staff, locations, branding, insurance panels. |
| 4 | **Echo** | Transcript Analyst | Client Intelligence | Researcher | 2h | Processes call transcripts. Extracts pain points, goals, action items, sentiment shifts. Updates client profiles after every call. |
| 5 | **Apollo** | VP Campaign Operations | Campaigns | CMO | 2h | Owns multi-channel campaign pipeline. Produces quarterly calendars for all practices: email, SMS, social, GBP, landing pages. |
| 6 | **Muse** | Campaign Strategist | Campaigns | PM | 2h | Generates campaign plans from client intelligence. Analyzes EPRS scores, seasonality, competitive landscape. Outputs calendars and content briefs. |
| 7 | **Quill** | Content Generator | Campaigns | Designer | 2h | Creates all marketing content. Uses client intelligence for personalization, brand guidelines for tone. Outputs Patient Engage-ready format. |
| 8 | **Oracle** | VP Analytics & Reporting | Analytics | CTO | 2h | Owns reporting across 10-15 marketing platforms. Manages data pipelines, performance reports, and anomaly detection. |
| 9 | **Flux** | Data Aggregator | Analytics | DevOps | 1h | Pulls from Google Analytics, SEMrush, BrightLocal, Facebook Ads, GSC, Patient Engage, EHR. Normalizes into unified datasets. |
| 10 | **Sentinel** | Alert Monitor | Analytics | QA | 1h | Monitors all practices for anomalies: keyword drops, open rate decline, traffic changes, conversion shifts. Fires contextual alerts with root cause analysis. |
| 11 | **Compass** | SEO Auditor | Analytics | Researcher | 2h | 15-point SEO audits: on-site, rankings, GA, GSC, BrightLocal, citations, backlinks, competitive positioning. Outputs prioritized fix lists. |
| 12 | **Relay** | Meeting Assistant | Cross-Functional | General | 2h | Pre-call: agenda, performance data, talking points. Post-call: transcript processing, action items, follow-up drafts, profile updates. |

---

## Configuration Reference

### config.yaml — Full Reference

```yaml
# ============================================================================
# Workers Configuration Reference
# ============================================================================
# All string values support ${ENV_VAR} and ${ENV_VAR:-default} interpolation.

paperclip:
  # REQUIRED. URL of the Paperclip API server.
  url: "http://localhost:3100"

  # REQUIRED. Company slug (URL-safe name) in Paperclip.
  # Created by setup-nsg.sh — check the dashboard URL to find it.
  companySlug: "nsg-ai-operations"

  # OPTIONAL. Board-level API key for authenticated access.
  # Not needed for local dev (board access is implicit).
  apiKey: "${PAPERCLIP_API_KEY}"

polling:
  # How often to check for new tasks (milliseconds).
  # Lower = more responsive, higher = less API load.
  # Default: 30000 (30 seconds)
  intervalMs: 30000

  # Maximum number of tasks executing simultaneously across all agents.
  # Prevents overloading runtimes. Each agent also has its own maxConcurrent.
  # Default: 3
  maxConcurrentTasks: 3

defaults:
  # Default runtime for agents that don't specify one.
  # Values: "openclaw" | "hermes"
  runtime: openclaw

  # Default adapter mode.
  # For openclaw: "gateway" (WebSocket) or "telegram" (bot message)
  # For hermes: "api" (HTTP) or "cli" (subprocess)
  mode: telegram

  # Default task timeout in milliseconds.
  # Task is marked failed if runtime doesn't respond within this window.
  # Default: 300000 (5 minutes)
  timeout: 300000

agents:
  # Each entry maps a Paperclip agent to an AI runtime endpoint.
  # The 'name' field is matched case-insensitively against agent names in Paperclip.

  - name: "AgentName"          # REQUIRED. Must match agent name in Paperclip.

    runtime: openclaw           # OPTIONAL. Overrides defaults.runtime.
                                # Values: "openclaw" | "hermes"

    mode: gateway               # OPTIONAL. Overrides defaults.mode.
                                # openclaw modes: "gateway" | "telegram"
                                # hermes modes: "api" | "cli"

    endpoint: "ws://host:port"  # REQUIRED for gateway/api modes.
                                # WebSocket URL for openclaw/gateway.
                                # HTTP URL for hermes/api.

    botToken: "123:ABC"         # REQUIRED for telegram mode.
                                # Telegram bot token from @BotFather.

    chatId: "987654321"         # REQUIRED for telegram mode.
                                # Telegram chat ID where bot sends messages.

    model: "claude-sonnet-4-20250514"  # OPTIONAL. Model identifier for hermes/api mode.
                                # Ignored for openclaw runtimes.

    timeout: 600000             # OPTIONAL. Overrides defaults.timeout.
                                # Per-agent timeout in milliseconds.

    maxConcurrent: 1            # OPTIONAL. Max concurrent tasks for this agent.
                                # Default: 1. Increase for agents that can parallelize
                                # (e.g., Flux doing multiple data pulls).
```

### Environment Variables

| Variable | Used By | Description |
|----------|---------|-------------|
| `PAPERCLIP_API_KEY` | Workers | Board-level API key for Paperclip authentication |
| `WORKER_CONFIG` | Workers | Override config file path (alternative to `--config` flag) |
| `DATABASE_URL` | Paperclip | Postgres connection string. Leave empty for embedded PGlite. |
| `PORT` | Paperclip | API server port (default: 3100) |
| `SERVE_UI` | Paperclip | Set `true` to serve React UI from the API server |
| `BETTER_AUTH_SECRET` | Paperclip | Secret for session signing (auto-generated if not set) |
| `AWS_ACCESS_KEY_ID` | OpenClaw | AWS credentials for Bedrock |
| `AWS_SECRET_ACCESS_KEY` | OpenClaw | AWS credentials for Bedrock |
| `AWS_REGION` | OpenClaw | AWS region for Bedrock (e.g., us-east-1) |
| `ANTHROPIC_API_KEY` | OpenClaw/Hermes | Anthropic API key for direct Claude access |
| `*_BOT_TOKEN` | Workers | Telegram bot token per agent (e.g., `ATLAS_BOT_TOKEN`) |
| `*_CHAT_ID` | Workers | Telegram chat ID per agent (e.g., `ATLAS_CHAT_ID`) |

---

## Deployment

### Local Development

This is what the Quick Start guide sets up. Everything runs on your machine:

- Paperclip on `localhost:3100` with embedded PGlite
- Workers process polling locally
- OpenClaw gateway on `localhost:18789`
- Hermes API on `localhost:8642` (if used)

Good for testing. Reset everything by deleting `data/pglite/` and re-running `setup-nsg.sh`.

### Docker Compose (All-in-One)

For a self-contained deployment with external Postgres:

```yaml
# docker-compose.yml
version: "3.8"
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: paperclip
      POSTGRES_PASSWORD: paperclip
      POSTGRES_DB: paperclip
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  paperclip:
    build:
      context: .
      dockerfile: Dockerfile.fly
    ports:
      - "3100:3100"
    environment:
      DATABASE_URL: postgres://paperclip:paperclip@postgres:5432/paperclip
      PORT: "3100"
      SERVE_UI: "true"
      NODE_ENV: production
    depends_on:
      - postgres

  workers:
    build:
      context: ./workers
    environment:
      WORKER_CONFIG: /app/config.yaml
      PAPERCLIP_API_KEY: ${PAPERCLIP_API_KEY}
    volumes:
      - ./workers/config.yaml:/app/config.yaml:ro
    depends_on:
      - paperclip

volumes:
  pgdata:
```

### Production: Fly.io + MacStadium

This is the NSG production setup:

**Paperclip on Fly.io:**

The repo includes `fly.toml` and `Dockerfile.fly` pre-configured for Fly.io deployment.

```bash
# First-time deploy
fly launch --no-deploy
fly volumes create paperclip_data --size 1 --region sjc
fly deploy

# The app uses a persistent volume at /paperclip for PGlite data.
# Public URL: https://nsg-paperclip.fly.dev
```

Key `fly.toml` settings:
- Region: `sjc` (San Jose — close to the team)
- Machine: `shared-cpu-1x`, 512MB RAM (sufficient for the control plane)
- Auto-suspend: enabled (saves cost when idle, resumes on request)
- Persistent volume: 1GB at `/paperclip` for database and config

**Workers + AI Runtimes on MacStadium (or any always-on machine):**

The workers and OpenClaw runtimes need a persistent machine — they maintain WebSocket connections and Telegram bot sessions.

```bash
# On your MacStadium / dedicated server:

# 1. Start OpenClaw gateway
openclaw gateway run --port 18789

# 2. Configure workers to point to Fly.io Paperclip
# In config.yaml:
#   paperclip:
#     url: "https://nsg-paperclip.fly.dev"

# 3. Start workers
cd workers && npm run dev
```

This split makes sense because:
- Paperclip is stateless (just serves the API + UI) — Fly.io is cheap and auto-scales
- Workers need to maintain long-running connections — dedicated hardware is more reliable
- OpenClaw agents may need local filesystem access for tools — can't run on serverless

---

## Troubleshooting

### "Config file not found"

The workers look for `config.yaml` in the current directory by default.

```bash
# Fix: specify the path
npm run dev -- --config /path/to/config.yaml

# Or set the env var
export WORKER_CONFIG=/path/to/config.yaml
```

### "Agent not found in Paperclip" (name mismatch)

Agent names in `config.yaml` must match the names created by `setup-nsg.sh` exactly (case-insensitive). Check your Paperclip dashboard for the exact names. Common mistake: extra spaces or typos.

### Context overflow / "maximum context length exceeded"

Long-running agents (especially Atlas and Muse) can accumulate large contexts. The fix:

1. In Paperclip's agent config, set `defaultContextWindow` to limit context size
2. Use shorter heartbeat intervals so agents process work in smaller chunks
3. For OpenClaw, configure `maxTokens` in the agent's runtime config

### Agent not picking up tasks

Check this sequence:

1. **Is the task in `todo` status?** Workers only pick up `todo` tasks, not `backlog`.
2. **Is the task assigned?** The task's `assigneeAgentId` must match an agent in your config.
3. **Are workers running?** Check worker logs for polling activity.
4. **Is the runtime reachable?** Test the endpoint directly:

```bash
# Test OpenClaw gateway
wscat -c ws://localhost:18789

# Test Hermes API
curl http://localhost:8642/v1/health
```

### Credential errors (AWS/Anthropic)

```bash
# Verify AWS credentials
aws sts get-caller-identity

# Verify Anthropic key
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "content-type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'
```

### Paperclip dashboard is empty after setup

The `setup-nsg.sh` script requires Paperclip to be running and onboarding to be completed first. The script talks to `http://localhost:3100/api`. If onboarding isn't done, the API returns auth errors silently.

Fix: Complete the onboarding wizard in the browser first, then re-run `bash setup-nsg.sh`.

### Reset everything

```bash
# Nuclear option — delete all data and start fresh
rm -rf data/pglite
pnpm dev
# Complete onboarding again
bash setup-nsg.sh
```

### Fly.io deployment issues

```bash
# Check logs
fly logs

# SSH into the machine
fly ssh console

# Check if the volume is mounted
fly ssh console -C "ls -la /paperclip"

# Restart
fly machine restart
```

---

## Next Steps

Once the swarm is running:

1. **Move tasks from backlog to todo** — Workers only pick up `todo` tasks. Move the pilot tasks to get agents working.
2. **Watch the dashboard** — Agent activity, task progress, and costs show up in real-time.
3. **Set up Telegram bots for VPs** — Atlas, Athena, Apollo, Oracle, and Relay work best with Telegram for human-in-the-loop review.
4. **Tune heartbeat intervals** — The defaults (1-4 hours) are conservative. Reduce them for faster autonomous operation.
5. **Add more practices** — Create new tasks in Paperclip, assign them to Scout/Muse/Quill, and the agents handle the rest.
