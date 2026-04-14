# NSG AI Swarm — Architecture

Technical deep-dive into how the system works.

---

## System Components

The NSG AI Swarm has three layers. Each layer is independently deployable and replaceable.

### Layer 1: Paperclip (Control Plane)

**What it is:** A Node.js + React application that manages the organizational structure of an AI company.

**Runs on:** Port 3100. Single process. Embedded PGlite (dev) or external Postgres (prod).

**Responsibilities:**
- Company, agent, and org chart management
- Task/issue lifecycle (backlog → todo → in_progress → in_review → done)
- Goal hierarchy (company goals → team goals → individual tasks)
- Budget tracking and enforcement per agent
- Activity logging and audit trail
- REST API for all operations
- React dashboard for human operators

**Does NOT do:**
- Execute AI tasks
- Hold LLM API keys
- Communicate with AI models
- Manage runtime processes

**Key API endpoints used by the swarm:**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/companies` | List companies |
| `GET` | `/api/companies/:id/agents` | List agents in a company |
| `GET` | `/api/companies/:id/issues` | List issues (filterable by status, assignee) |
| `PATCH` | `/api/companies/:id/issues/:issueId` | Update issue status |
| `POST` | `/api/companies/:id/issues/:issueId/comments` | Post a comment (task result) |
| `GET` | `/api/companies/:id/goals` | List goals |
| `GET` | `/api/health` | Health check |

**Database schema (relevant tables):**

```
companies          — id, name, slug, description, budgetMonthlyCents
agents             — id, name, role, title, icon, capabilities, companyId, reportsTo, adapterType, budgetMonthlyCents, runtimeConfig
issues             — id, title, description, status, priority, assigneeAgentId, companyId, goalId
goals              — id, title, description, level, status, parentId, ownerAgentId, companyId
agent_api_keys     — id, agentId, keyHash (bearer tokens for agent-level API access)
activity_log       — id, companyId, actorType, action, entityType, entityId, metadata, createdAt
```

All entities are company-scoped. A single Paperclip deployment can run multiple companies with complete data isolation.

### Layer 2: Workers (Orchestrator)

**What it is:** A TypeScript process that bridges Paperclip and AI runtimes.

**Runs on:** Any machine with network access to both Paperclip and the AI runtimes.

**Responsibilities:**
- Poll Paperclip for `todo` tasks assigned to mapped agents
- Dispatch tasks to the correct AI runtime (OpenClaw gateway, Telegram bot, or Hermes API)
- Report results back to Paperclip (comments + status updates)
- Handle timeouts and errors gracefully
- Manage concurrency limits per agent and globally

**Components:**

```
workers/
├── src/
│   ├── config.ts          — YAML config loader with env var interpolation
│   ├── types.ts           — TypeScript interfaces for all data structures
│   ├── logger.ts          — Structured logging with component prefixes
│   ├── paperclip/
│   │   └── client.ts      — REST client for Paperclip API
│   ├── adapters/
│   │   ├── openclaw.ts    — OpenClaw gateway (WebSocket) + Telegram adapters
│   │   └── hermes.ts      — Hermes HTTP API adapter
│   ├── poller.ts          — Polls Paperclip for actionable tasks
│   ├── dispatcher.ts      — Routes tasks to the correct adapter
│   ├── reporter.ts        — Posts results back to Paperclip
│   └── index.ts           — Entry point, wires everything together
├── config.example.yaml
├── package.json
└── tsconfig.json
```

**Config loading flow:**

1. Read YAML file (path from `--config` flag, `WORKER_CONFIG` env, or `./config.yaml`)
2. Interpolate `${ENV_VAR}` and `${ENV_VAR:-default}` references
3. Validate structure (required fields, valid runtime/mode combos)
4. Resolve agent names against Paperclip API (populate `agentId` fields)
5. Return typed `OrchestratorConfig`

### Layer 3: AI Runtimes

**What they are:** LLM-powered agents that actually execute tasks.

**Supported runtimes:**

| Runtime | Modes | Protocol | Best For |
|---------|-------|----------|----------|
| **OpenClaw** | `gateway` (WebSocket) | WS on port 18789 | Automated tasks, tool-using agents |
| **OpenClaw** | `telegram` (Bot API) | Telegram Bot API | Human-in-the-loop, async review |
| **Hermes** | `api` (HTTP) | REST on port 8642 | Stateless task execution |
| **Hermes** | `cli` (subprocess) | stdin/stdout | Local development, testing |

**Runtime responsibilities:**
- Receive task payload (title, description, context)
- Execute using LLM (Claude, GPT, etc.) with appropriate tools
- Return structured result (success/failure, output text, duration)

**Runtimes are stateless from the swarm's perspective.** They don't track what task they're working on or what happened last time. All state lives in Paperclip. This means runtimes can be restarted, scaled, or replaced without affecting the swarm's operation.

---

## Data Flow

### Task Lifecycle

```
                    Human / Atlas heartbeat
                           │
                           ▼
              ┌─────────────────────────┐
              │  1. Task Created         │
              │     status: backlog      │
              │     assigned to: Scout   │
              └────────────┬────────────┘
                           │  Human moves to todo
                           ▼
              ┌─────────────────────────┐
              │  2. Task Ready           │
              │     status: todo         │
              └────────────┬────────────┘
                           │  Worker picks up (next poll cycle)
                           ▼
              ┌─────────────────────────┐
              │  3. Task Dispatched      │
              │     status: in_progress  │
              │     Worker → Runtime     │
              └────────────┬────────────┘
                           │  Runtime completes
                           ▼
              ┌─────────────────────────┐
              │  4. Result Reported      │
              │     Comment posted       │
              │     status: in_review    │
              └────────────┬────────────┘
                           │  VP or human approves
                           ▼
              ┌─────────────────────────┐
              │  5. Task Complete        │
              │     status: done         │
              └─────────────────────────┘
```

### Polling Cycle (every 30 seconds by default)

```
Worker                          Paperclip                       Runtime
  │                                │                               │
  │  GET /issues?status=todo       │                               │
  │───────────────────────────────►│                               │
  │  [issues with assignees]       │                               │
  │◄───────────────────────────────│                               │
  │                                │                               │
  │  For each issue:               │                               │
  │  Match assignee → agent config │                               │
  │  Check concurrency limits      │                               │
  │                                │                               │
  │  PATCH /issues/:id             │                               │
  │  {status: "in_progress"}       │                               │
  │───────────────────────────────►│                               │
  │                                │                               │
  │  Dispatch to runtime           │                               │
  │────────────────────────────────────────────────────────────────►│
  │                                │                        Execute │
  │                                │                               │
  │  Result                        │                               │
  │◄────────────────────────────────────────────────────────────────│
  │                                │                               │
  │  POST /issues/:id/comments     │                               │
  │  {content: result.output}      │                               │
  │───────────────────────────────►│                               │
  │                                │                               │
  │  PATCH /issues/:id             │                               │
  │  {status: "in_review"}         │                               │
  │───────────────────────────────►│                               │
  │                                │                               │
```

### Heartbeat Flow (Agent Self-Management)

Paperclip supports scheduled heartbeats per agent. When a heartbeat fires:

1. Paperclip triggers the agent's adapter
2. The agent receives its current context: assigned tasks, goal hierarchy, org position
3. The agent decides what to do: pick up a task, delegate work, report status, or escalate
4. Any actions are recorded in the activity log

Heartbeat intervals in the NSG swarm:
- Atlas (CEO): every 4 hours — strategic review cadence
- VPs (Athena, Apollo, Oracle): every 2 hours — operational review
- Specialists (Scout, Echo, Muse, etc.): every 2 hours — task execution
- Flux, Sentinel: every 1 hour — data and monitoring agents need faster cycles

---

## Agent Hierarchy and Routing

### Org Structure

```
                        Atlas (CEO)
                       /     |      \
                      /      |       \
              Athena (VP)  Apollo (VP)  Oracle (VP)      Relay
             /    \        /    \       /   |    \
          Scout  Echo   Muse  Quill  Flux Sentinel Compass
```

### Delegation Model

Tasks flow **down** the hierarchy:

1. Company-level goals are owned by Atlas
2. Atlas breaks them into department objectives → assigned to VPs
3. VPs break objectives into specific tasks → assigned to specialists
4. Specialists execute and report results **up**

Example flow for a new practice onboarding:

```
Atlas: "Onboard Pacific Eye Associates for Q2"
  └─► Athena: "Build client intelligence profile"
       ├─► Scout: "Scrape pacificeyesf.com — extract services, staff, locations"
       └─► Echo: "Process 3 recent call transcripts — extract pain points"
  └─► Apollo: "Generate Q2 campaign plan"
       ├─► Muse: "Create campaign calendar based on intelligence profile"
       └─► Quill: "Generate content for email, social, GBP"
  └─► Oracle: "Establish baseline metrics"
       ├─► Flux: "Pull 6 months historical data from all platforms"
       ├─► Compass: "Run 15-point SEO audit"
       └─► Sentinel: "Configure alert rules"
  └─► Relay: "Generate pre-call brief for planning meeting"
```

### Routing Rules

The worker determines which runtime handles each agent based on `config.yaml`. There's no intelligent routing — it's explicit configuration. Each agent maps to exactly one runtime endpoint.

VPs and Atlas typically use **Telegram mode** because their work involves judgment calls that benefit from human review in a chat interface.

Specialists typically use **gateway mode** because their work is more automated and structured — scrape this website, process this transcript, pull this data.

---

## Security Model

### Access Tiers

| Actor | Access | Authentication |
|-------|--------|----------------|
| **Human operator** | Full dashboard + all APIs | Email/password via Better Auth sessions |
| **Agent (via API key)** | Own company's data only | Bearer token (hashed at rest in `agent_api_keys`) |
| **Worker process** | Company data for mapped agents | Board-level API key or session token |

### Company Isolation

Every database query is scoped to a `companyId`. An agent in Company A cannot read or modify data in Company B, even if both run on the same Paperclip instance. This is enforced at the service layer, not just the API routes.

### Secret Management

- **Paperclip** stores no LLM API keys. Those live in the runtime environment.
- **Workers** use `${ENV_VAR}` interpolation for secrets in config. Secrets never appear in YAML files.
- **Agent API keys** are hashed with bcrypt before storage. Raw keys are shown once at creation.
- **Telegram bot tokens** are runtime secrets, stored in environment variables or a secrets manager.
- **fly.toml** uses Fly.io's secrets for `BETTER_AUTH_SECRET` and other sensitive values.

### Budget Enforcement

Each agent has a `budgetMonthlyCents` limit. Paperclip tracks token usage and cost per agent. When an agent hits its budget:

1. The agent is auto-paused
2. New task dispatches are blocked
3. The activity log records the pause event
4. A human operator must increase the budget or wait for the monthly reset

This prevents runaway costs — a misbehaving agent can't spend more than its allocation.

---

## Scaling Considerations

### Current NSG Scale

- 1 Paperclip instance (Fly.io, shared-cpu-1x, 512MB RAM)
- 1 worker process (MacStadium)
- 12 agents, ~50 active tasks at any time
- ~1,000 practices in the system

This comfortably handles the current workload. The bottleneck is LLM throughput, not the control plane.

### Scaling Paperclip

Paperclip is a single Node.js process. For higher throughput:

1. **Vertical:** Increase Fly.io machine size (up to 8 CPU, 16GB RAM)
2. **Horizontal:** Switch from embedded PGlite to external Postgres, then run multiple Paperclip instances behind a load balancer
3. **Database:** PGlite handles ~100 concurrent connections well. For higher load, use managed Postgres (Fly Postgres, RDS, Neon)

### Scaling Workers

The worker process is lightweight — it's just HTTP polling and WebSocket/HTTP dispatching. To scale:

1. **More concurrent tasks:** Increase `polling.maxConcurrentTasks` in config
2. **Multiple worker instances:** Run separate workers for different departments (one config per department). Each worker only maps the agents it manages, so there's no double-dispatch.
3. **Faster polling:** Reduce `polling.intervalMs` for lower latency. 5 seconds is reasonable for production.

### Scaling Runtimes

This is where the real scaling happens:

1. **Multiple OpenClaw gateways:** Run separate gateway instances for different agent groups. Map each agent to its own gateway endpoint.
2. **Model tiering:** Use cheaper/faster models for high-volume agents (Scout, Flux) and more capable models for strategic agents (Atlas, Muse).
3. **Regional distribution:** Run runtimes close to data sources (e.g., a Flux instance near Google's APIs).

### Scaling to 10,000 Practices

The NSG roadmap targets 10,000 practices. This requires:

- Batching in specialist agents (Scout processes 100 practices per task, not 1)
- Parallel workers (10 worker instances, each handling 1,000 practices)
- Sharded Telegram bots (one bot per department, not per agent)
- Rate limit management for third-party APIs (Google, SEMrush, BrightLocal)
- Caching layer for client intelligence data (not every task needs a fresh scrape)

---

## Key Design Decisions

### Why Paperclip as control plane (not a custom system)?

Paperclip already solves org charts, task tracking, budgets, governance, and audit logging. Building this from scratch would take months. By forking Paperclip, NSG gets a mature control plane and can focus on the domain-specific work: agent capabilities, campaign logic, and marketing platform integrations.

### Why separate workers from Paperclip?

Paperclip is designed to be runtime-agnostic. It doesn't know or care how tasks get executed. The worker layer keeps that separation clean:

- Paperclip can upgrade independently of the workers
- Workers can be rewritten (e.g., from TypeScript to Rust) without touching Paperclip
- Different deployments can use different worker strategies (polling vs. webhooks vs. event-driven)

### Why Telegram for VP-level agents?

The NSG swarm serves human marketing strategists. These strategists need to review and approve agent work — campaign plans, client profiles, alert responses. Telegram provides:

- Mobile access (strategists check on the go)
- Threaded conversations (each task is a message thread)
- File sharing (agents can send reports, presentations, CSVs)
- Human-in-the-loop without a custom UI

Gateway mode is for agents that run fully autonomously. Telegram mode is for agents that need human judgment in the loop.

### Why YAML for worker config (not database)?

The worker config is deployment-specific, not business-logic. It maps agents to infrastructure endpoints. YAML with env var interpolation is:

- Version-controllable (commit to git, minus secrets)
- Environment-aware (`${ENV_VAR}` for dev/staging/prod differences)
- Human-readable (ops team can review without a dashboard)
- Declarative (the full state is in one file, not spread across API calls)

### Why embedded PGlite in development?

Zero-config database. `pnpm dev` just works. No Docker, no Postgres install, no connection strings. The database lives in `data/pglite/` and can be reset by deleting the directory. For production, swap to a real Postgres by setting `DATABASE_URL`.

---

## File Map

```
nsg-ai-swarm/
├── README.md                   — Project overview (you are here)
├── setup-nsg.sh                — Seeds the 12-agent org, goals, and pilot tasks
├── fly.toml                    — Fly.io deployment config
├── Dockerfile.fly              — Production Docker image
├── .env.example                — Environment variable template
│
├── docs/
│   ├── GETTING_STARTED.md      — Step-by-step setup guide
│   └── ARCHITECTURE.md         — This document
│
├── workers/                    — Orchestrator bridge
│   ├── src/
│   │   ├── index.ts            — Entry point
│   │   ├── config.ts           — YAML config loader
│   │   ├── types.ts            — TypeScript interfaces
│   │   ├── logger.ts           — Structured logging
│   │   └── paperclip/
│   │       └── client.ts       — Paperclip REST client
│   ├── config.example.yaml
│   ├── package.json
│   └── tsconfig.json
│
├── server/                     — Paperclip API server
├── ui/                         — Paperclip React dashboard
├── packages/
│   ├── db/                     — Drizzle ORM schema + migrations
│   ├── shared/                 — Shared types and constants
│   ├── adapters/               — Agent runtime adapters
│   ├── adapter-utils/          — Shared adapter utilities
│   └── plugins/                — Plugin system
│
└── doc/                        — Upstream Paperclip documentation
    ├── DEVELOPING.md
    ├── DATABASE.md
    ├── DEPLOYMENT-MODES.md
    ├── SPEC.md
    └── SPEC-implementation.md
```
