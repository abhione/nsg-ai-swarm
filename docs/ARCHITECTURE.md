# NSG AI Swarm — Architecture

Technical deep-dive into how the NSG vision care marketing swarm operates.

## System Components

```
+------------------------------------------------------------------+
|                     NSG AI SWARM — OVERVIEW                       |
+------------------------------------------------------------------+
|                                                                    |
|  +-------------------+     +----------------------------------+   |
|  |   Board Operator  |     |        Paperclip Server          |   |
|  |   (Human / Web)   |---->|   +-----------+ +------------+   |   |
|  +-------------------+     |   | REST API  | | Heartbeat  |   |   |
|                            |   | :3100     | | Scheduler  |   |   |
|                            |   +-----------+ +------------+   |   |
|                            |   | Activity  | | Budget     |   |   |
|                            |   | Logger    | | Enforcer   |   |   |
|                            |   +-----------+ +------------+   |   |
|                            +-----------|-------|-------------+    |
|                                        |       |                  |
|                            +-----------v-------v-----------+     |
|                            |      PostgreSQL / PGlite      |     |
|                            |  agents | issues | cost_events|     |
|                            |  runs | sessions | budgets    |     |
|                            +---------|--------|------------+     |
|                                      |        |                   |
|                     +----------------+--------+---------+         |
|                     |                                   |         |
|          +----------v-----------+         +-------------v-----+  |
|          |   Adapter Layer      |         |   Adapter Layer    |  |
|          |   (OpenClaw GW)      |         |   (Hermes HTTP)    |  |
|          +----------+-----------+         +-------------+-----+  |
|                     |                                   |         |
|     +---------------+---------------+       +-----------+------+ |
|     |       |       |       |       |       |     |     |      | |
|   +---+  +-----+ +-----+ +------+ +---+ +---+ +---+ +-----+  | |
|   |Iris| |Clar.| |Prism| |Retina| |Len| |Foc| |Spe| |Optic|  | |
|   |CEO | |CMO  | |Soc. | |PPC   | |CTO| |SEO| |Con| |CFO  |  | |
|   +---+  +-----+ +-----+ +------+ +---+ +---+ +---+ +-----+  | |
|   OpenClaw (macOS / MacStadium)     Hermes (HTTP API)          | |
|                                                                  |
+------------------------------------------------------------------+
         |                                          |
         v                                          v
  +-------------+                          +-----------------+
  | Telegram    |                          | External APIs   |
  | Bot API     |                          | (Google Ads,    |
  | (social     |                          |  Meta, Search   |
  |  channels)  |                          |  Console, etc.) |
  +-------------+                          +-----------------+
```

## Data Flow

### Issue Lifecycle

```
  Human Board                Paperclip               Adapter              Agent Runtime
       |                        |                       |                       |
       |  1. Create Issue       |                       |                       |
       |  "Draft Q2 blog        |                       |                       |
       |   calendar for         |                       |                       |
       |   vision care"         |                       |                       |
       |----------------------->|                       |                       |
       |                        |                       |                       |
       |                        | 2. Assign to          |                       |
       |                        |    Spectrum (Content)  |                       |
       |                        |---------------------->|                       |
       |                        |                       |                       |
       |                        | 3. Heartbeat fires    |                       |
       |                        |    (timer or           |                       |
       |                        |     assignment wake)   |                       |
       |                        |---------------------->|                       |
       |                        |                       | 4. Dispatch to        |
       |                        |                       |    Hermes runtime     |
       |                        |                       |--------------------->|
       |                        |                       |                       |
       |                        |                       |  5. Agent processes   |
       |                        |                       |     task, generates   |
       |                        |                       |     blog calendar     |
       |                        |                       |                       |
       |                        |                       | 6. POST results back  |
       |                        |                       |<---------------------|
       |                        |                       |                       |
       |                        | 7. Update issue:      |                       |
       |                        |    comment + status    |                       |
       |                        |    + cost event        |                       |
       |                        |<----------------------|                       |
       |                        |                       |                       |
       | 8. UI updates live     |                       |                       |
       |   (SSE push)           |                       |                       |
       |<-----------------------|                       |                       |
```

### Delegation Flow (Agent-to-Agent)

```
  Iris (CEO)            Paperclip            Clarity (CMO)         Prism (Social)
       |                    |                      |                      |
       | "Q2 campaign       |                      |                      |
       |  needs social      |                      |                      |
       |  media strategy"   |                      |                      |
       |------------------->|                      |                      |
       |                    | Create sub-issue     |                      |
       |                    | assigned to Clarity  |                      |
       |                    |--------------------->|                      |
       |                    |                      |                      |
       |                    |  Clarity processes   |                      |
       |                    |  and creates         |                      |
       |                    |  sub-sub-issues      |                      |
       |                    |<---------------------|                      |
       |                    |                      |                      |
       |                    | Create sub-issue:    |                      |
       |                    | "3 IG posts/week     |                      |
       |                    |  for blue light      |                      |
       |                    |  glasses"            |                      |
       |                    |  assigned to Prism   |                      |
       |                    |------------------------------------->|     |
       |                    |                      |               |     |
       |                    |                      |    Prism      |     |
       |                    |                      |    executes,  |     |
       |                    |                      |    posts      |     |
       |                    |                      |    results    |     |
       |                    |<-------------------------------------|     |
       |                    |                      |                      |
       | Roll-up: all sub   |                      |                      |
       | tasks done =>      |                      |                      |
       | parent done        |                      |                      |
       |<-------------------|                      |                      |
```

## Agent Hierarchy and Delegation Model

The NSG swarm follows a strict org tree. Delegation flows downward; results roll upward.

```
                            Iris (CEO)
                     vision care strategy
                     adapter: openclaw_gateway
                            |
              +-------------+-------------+
              |             |             |
         Lens (CTO)   Clarity (CMO)  Optic (CFO)
         martech       brand/campaign   budget/ROI
         hermes_local  openclaw_gw      hermes_local
              |             |                 |
         Focal (SEO)   +---+---+        Cornea (Analytics)
         hermes_local  |       |         hermes_local
                    Spectrum  Prism
                    (Content) (Social)
                    hermes    openclaw_gw
                              |
                          Retina (PPC)
                          openclaw_gw
```

### Delegation Rules

1. **Downward only** — Agents create sub-issues assigned to their direct reports
2. **Atomic checkout** — Only one agent works an issue at a time
3. **Approval gates** — CEO strategy proposals require board approval
4. **Budget-aware** — Agents cannot delegate work that would exceed their subtree's budget
5. **Goal alignment** — Every issue must trace back to a company goal through the parent chain

### Agent Responsibilities (NSG Vision Care)

| Agent | Role | Key Tasks |
|---|---|---|
| **Iris** | CEO | Strategic planning, quarterly OKR setting, executive review, board reports |
| **Lens** | CTO | Marketing technology stack, automation workflows, SEO infrastructure |
| **Clarity** | CMO | Campaign strategy, brand voice, content calendar, channel mix optimization |
| **Optic** | CFO | Budget allocation, ROI analysis, cost optimization, financial reporting |
| **Focal** | SEO Specialist | Keyword research, on-page optimization, backlink strategy, rank tracking |
| **Spectrum** | Content Writer | Blog posts, email campaigns, patient education materials, landing pages |
| **Prism** | Social Media | Instagram, Facebook, TikTok content; engagement management; influencer outreach |
| **Retina** | PPC Specialist | Google Ads, Meta Ads, retargeting campaigns, bid optimization |
| **Cornea** | Analytics | Weekly/monthly reports, attribution modeling, funnel analysis, dashboard maintenance |

## OpenClaw Integration

OpenClaw agents run on macOS hosts via the Telegram Bot API + WebSocket Gateway.

### Architecture

```
  Paperclip Server
       |
       | WebSocket (wss://)
       v
  OpenClaw Gateway (:18789)
       |
       | Local process management
       v
  OpenClaw Agent Runtime
       |
       +--- SOUL.md (agent persona + instructions)
       +--- HEARTBEAT.md (per-heartbeat prompt)
       +--- Tools (browser, file system, shell)
       +--- Telegram Bot API (for social channel agents)
       +--- AWS Bedrock / Anthropic API (LLM backend)
```

### Communication Protocol

1. **Paperclip -> OpenClaw**: WebSocket message with task context, issue details, prompt
2. **OpenClaw -> LLM**: Claude via AWS Bedrock (Sonnet 4) or direct Anthropic API
3. **OpenClaw -> Paperclip**: HTTP callbacks with results, status updates, cost events
4. **OpenClaw -> Telegram**: Bot API calls for social media agents (Prism posts to channels)

### Device Pairing

OpenClaw uses device-based authentication:
- First connection requires device pairing approval
- Persisted `devicePrivateKeyPem` for subsequent connections
- Shared gateway auth token for initial handshake

## Hermes Integration

Hermes agents run as stateless HTTP API services — fast, lightweight, horizontally scalable.

### Architecture

```
  Paperclip Server
       |
       | HTTP POST /run
       v
  Hermes API Server (:8642)
       |
       +--- Agent persona (from Paperclip config)
       +--- Tool permissions (scoped per agent)
       +--- Model routing (Claude Sonnet 4 / Haiku)
       |
       v
  Anthropic API / AWS Bedrock
```

### Request/Response Contract

```
POST /run
{
  "agentId": "focal-seo",
  "taskContext": { ... },
  "prompt": "...",
  "tools": ["web_search", "file_write", "paperclip_api"]
}

Response:
{
  "status": "completed",
  "result": "...",
  "tokenUsage": { "input": 2400, "output": 800 },
  "cost": { "usd": 0.012 }
}
```

### Smart Model Routing

Hermes routes to different models based on task complexity:
- **Claude Sonnet 4**: Complex analysis (Cornea reports, Focal keyword research)
- **Claude Haiku**: Simple operations (status updates, formatting, quick lookups)
- Routing decisions logged to `cost_events` for budget tracking

## Security Model

### API Token Scoping

```
  Board Operator (Human)
       |
       | Session cookie (Better Auth)
       | Full access to all companies
       |
  Agent API Keys
       |
       | Bearer token (hashed at rest)
       | Scoped to single company
       | Cannot access other companies
       | Cannot modify own adapter config
```

### Bot Allowlists

For OpenClaw Telegram agents:
- Each bot has an explicit Telegram chat ID allowlist
- Bots can only operate in pre-approved channels/groups
- Prism (Social Media) can post to @nsg_vision_care channel
- Iris (CEO) can receive board commands via private Telegram chat

### Network Security

- OpenClaw gateways: WSS with auth token + device key
- Hermes API: Bearer token authentication
- Paperclip API: Session cookies (human) or API keys (agents)
- All inter-service communication over TLS in production

### Secret Management

- Agent API keys hashed with bcrypt before storage
- Adapter credentials stored in Paperclip's encrypted secret store
- AWS Bedrock credentials: IAM role (MacStadium) or environment variables
- No secrets in agent prompts — injected at runtime by the adapter layer

## Scaling Considerations

### Horizontal Scaling

| Component | Scale Strategy |
|---|---|
| Paperclip Server | Single instance (V1); future: read replicas + load balancer |
| PostgreSQL | Single instance; future: managed Postgres (RDS/Supabase) |
| OpenClaw Agents | One macOS host per 3-5 agents (MacStadium fleet) |
| Hermes Agents | Stateless — scale with container replicas (Fly.io, ECS) |

### Current NSG Swarm Resource Profile

```
  9 agents total
  4 OpenClaw agents -> 1 MacStadium Mac Mini (M2, 16GB)
  5 Hermes agents  -> 1 Fly.io machine (2 vCPU, 1GB RAM)
  1 Paperclip      -> 1 Fly.io machine (2 vCPU, 1GB RAM)
  1 PostgreSQL     -> Fly.io Postgres (1GB)

  Estimated monthly cost:
    MacStadium:  ~$60/month
    Fly.io:      ~$30/month
    LLM tokens:  ~$800-2000/month (depending on activity)
    Total:       ~$900-2100/month
```

### Performance Targets

| Metric | Target | Current |
|---|---|---|
| Heartbeat latency (queue -> dispatch) | < 5s | ~2s |
| Agent run completion (median) | < 120s | ~45s |
| API response time (p95) | < 200ms | ~80ms |
| Concurrent agent runs | 4 | 4 |
| Issues processed per day | 50+ | ~35 |
| Dashboard load time | < 2s | ~1.2s |
