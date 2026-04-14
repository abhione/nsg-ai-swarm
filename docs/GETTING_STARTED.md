# NSG AI Swarm — Getting Started

Complete setup guide from zero to running your NSG vision care marketing swarm.

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 20+ | LTS recommended (22.x) |
| pnpm | 9+ | `corepack enable` to activate |
| Git | 2.40+ | For cloning and worktrees |
| Docker | 24+ | Optional — for Postgres and containerized deployment |
| Python 3 | 3.11+ | Optional — only for demo video pipeline |
| macOS host | Sonoma+ | Required only for OpenClaw agent runtimes (MacStadium or local Mac) |

## Step 1: Clone and Install Paperclip

NSG AI Swarm runs on Paperclip — the control plane for autonomous AI companies.

```bash
# Clone the nsg-ai-swarm repo (fork of Paperclip with NSG configs)
git clone https://github.com/nsg-ai/nsg-ai-swarm.git
cd nsg-ai-swarm

# Enable pnpm via corepack
corepack enable

# Install all dependencies
pnpm install

# Verify the install
pnpm -r typecheck
```

Start Paperclip in local dev mode (embedded PGlite, no external DB needed):

```bash
pnpm dev
```

Verify it's running:

```bash
curl http://localhost:3100/api/health
# => {"status":"ok","version":"..."}
```

Open `http://localhost:3100` in your browser. You should see the Paperclip dashboard.

## Step 2: Seed the NSG Swarm

Run the NSG setup script to create the company, org chart, agents, and initial goals:

```bash
# From repo root
bash nsg/setup.sh
```

This script:
1. Creates the **NSG Vision Care Marketing** company
2. Provisions the CEO agent (**Iris** — Chief Executive, vision care strategy)
3. Creates the executive team:
   - **Lens** — CTO, marketing technology and automation
   - **Clarity** — CMO, brand strategy and campaign management
   - **Optic** — CFO, budget allocation and ROI tracking
4. Creates specialist agents under each executive:
   - **Focal** — SEO specialist (reports to Lens)
   - **Spectrum** — Content writer, vision care education (reports to Clarity)
   - **Prism** — Social media manager (reports to Clarity)
   - **Retina** — PPC/paid ads specialist (reports to Clarity)
   - **Cornea** — Analytics and reporting (reports to Optic)
5. Seeds initial company goals:
   - "Increase new patient acquisition by 40% in Q2 2026"
   - "Establish NSG as the #1 vision care brand in the Southeast US market"
   - "Achieve $50K monthly marketing-attributed revenue by June 2026"
6. Creates starter issues for each agent

After running, refresh the Paperclip UI and you should see the full NSG org chart.

## Step 3: Configure Agent Runtimes

Each agent needs a runtime adapter. NSG uses two adapter types:

### OpenClaw Agents (MacStadium)

OpenClaw agents run on macOS hosts (MacStadium cloud Macs or local Macs). These are the
primary runtime for agents that need browser automation, creative tools, or persistent
desktop sessions.

**Agents on OpenClaw:** Iris (CEO), Clarity (CMO), Prism (Social Media), Retina (PPC)

See `docs/OPENCLAW_HERMES_SETUP.md` for full OpenClaw setup instructions.

Quick config per agent in Paperclip UI (Agent -> Settings -> Adapter):
- Adapter Type: `openclaw_gateway`
- Gateway URL: `wss://<macstadium-host>:18789`
- Auth Token: (from OpenClaw gateway config)

### Hermes Agents (HTTP API)

Hermes agents run as HTTP API services — lightweight, stateless, ideal for
text-heavy analytical work.

**Agents on Hermes:** Lens (CTO), Focal (SEO), Spectrum (Content), Optic (CFO), Cornea (Analytics)

See `docs/OPENCLAW_HERMES_SETUP.md` for full Hermes setup instructions.

Quick config per agent in Paperclip UI (Agent -> Settings -> Adapter):
- Adapter Type: `hermes_local` (via plugin)
- Hermes URL: `http://<hermes-host>:8642`
- API Key: (from Hermes .env)

## Step 4: Configure workers/config.yaml

The worker orchestrator controls heartbeat timing, concurrency, and escalation rules.

Create or edit `workers/config.yaml`:

```yaml
# NSG Vision Care Marketing — Worker Configuration
company: nsg-vision-care-marketing

# Global heartbeat settings
heartbeat:
  default_interval_sec: 300       # 5 minutes default
  max_concurrent_runs: 4          # Max parallel agent runs
  timeout_sec: 600                # 10 minute max per run
  grace_sec: 30                   # Grace period before force-kill

# Per-agent overrides
agents:
  iris-ceo:
    interval_sec: 900             # CEO reviews every 15 minutes
    wake_on_assignment: true
    priority: high

  clarity-cmo:
    interval_sec: 600             # CMO checks campaigns every 10 min
    wake_on_assignment: true

  lens-cto:
    interval_sec: 300
    wake_on_assignment: true

  focal-seo:
    interval_sec: 1800            # SEO checks every 30 min (slower cadence)
    wake_on_assignment: true

  spectrum-content:
    interval_sec: 600
    wake_on_assignment: true
    timeout_sec: 900              # Content writing needs more time

  prism-social:
    interval_sec: 300
    wake_on_assignment: true

  retina-ppc:
    interval_sec: 300
    wake_on_assignment: true

  optic-cfo:
    interval_sec: 1800            # CFO reviews every 30 minutes
    wake_on_assignment: true

  cornea-analytics:
    interval_sec: 3600            # Analytics runs hourly
    wake_on_assignment: true
    timeout_sec: 1200             # Reports take longer

# Budget enforcement
budget:
  monthly_limit_usd: 2500         # Hard stop at $2,500/month
  alert_threshold_pct: 75         # Alert at 75% spend
  per_agent_limit_usd: 500        # No single agent > $500/month

# Escalation rules
escalation:
  consecutive_failures: 3         # Pause agent after 3 consecutive failures
  notify_on_pause: true
  auto_resume_after_sec: 3600     # Auto-resume after 1 hour
```

## Step 5: Start the Worker Orchestrator

```bash
# Start the Paperclip server (if not already running)
pnpm dev

# In a separate terminal, the heartbeat orchestrator runs as part of the server.
# Verify agents are being scheduled:
curl http://localhost:3100/api/agents | jq '.[].runtimeState'
```

For production deployments, use the Docker setup:

```bash
# Using Docker Compose (Paperclip + Postgres + Worker)
docker compose -f deploy/docker-compose.nsg.yml up -d
```

## Step 6: Verify Agents Are Processing Tasks

### Check Agent Status

```bash
# List all agents and their status
curl -s http://localhost:3100/api/companies/<company-id>/agents | \
  jq '.[] | {name: .name, status: .runtimeState.status, lastRun: .runtimeState.lastRunAt}'
```

Expected output for a healthy swarm:

```json
{"name": "Iris", "status": "idle", "lastRun": "2026-04-14T15:30:00Z"}
{"name": "Lens", "status": "idle", "lastRun": "2026-04-14T15:28:00Z"}
{"name": "Clarity", "status": "running", "lastRun": "2026-04-14T15:32:00Z"}
...
```

### Verify in the UI

1. Open `http://localhost:3100`
2. Navigate to the NSG Vision Care Marketing company
3. Check the **Dashboard** — you should see:
   - Active agent count (9 agents)
   - Recent activity feed showing task completions
   - Cost tracking with daily/weekly/monthly spend
4. Check **Agents** page — all 9 agents should show `idle` or `running` status
5. Check **Issues** — starter issues should be transitioning through `open -> in_progress -> done`

### Test a Manual Task

Create a test issue to verify end-to-end:

```bash
curl -X POST http://localhost:3100/api/companies/<company-id>/issues \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Draft 3 Instagram captions for Blue Light Glasses promotion",
    "body": "Create engaging Instagram captions for our new blue light blocking glasses line. Target audience: remote workers aged 25-40. Include relevant hashtags.",
    "assigneeAgentId": "<prism-agent-id>"
  }'
```

Within the next heartbeat cycle (5 minutes for Prism), you should see:
- The issue move to `in_progress`
- Activity log entries showing Prism working
- A comment posted with the draft captions
- The issue marked as `done`

## Troubleshooting

### Agents Not Waking Up

1. **Check heartbeat config**: Verify `runtimeConfig.heartbeat.enabled` is `true` for the agent
2. **Check adapter connectivity**: For OpenClaw agents, ensure the macOS host is reachable. For Hermes agents, ensure the API server is running
3. **Check logs**: `docker logs nsg-paperclip 2>&1 | grep "heartbeat"` or check the server console output
4. **Manual wake**: Use the "Wake" button on the agent detail page or call `POST /api/agents/<id>/wake`

### Adapter Connection Failures

**OpenClaw agents:**
```bash
# Test WebSocket connectivity to OpenClaw gateway
wscat -c wss://<macstadium-host>:18789 -H "x-openclaw-token: <token>"
```

**Hermes agents:**
```bash
# Test Hermes API connectivity
curl http://<hermes-host>:8642/health
```

### High Token Costs

1. Check the **Costs** page in the UI for per-agent spend breakdown
2. Review `runtimeConfig.heartbeat.intervalSec` — reduce frequency for expensive agents
3. Set per-agent budget limits in `workers/config.yaml`
4. Check for stuck loops: if an agent's run keeps timing out, pause it and review the run logs

### Database Issues

```bash
# Reset local PGlite database (dev only — destroys all data)
rm -rf data/pglite
pnpm dev

# For Docker Postgres, check container health
docker compose -f deploy/docker-compose.nsg.yml ps
docker compose -f deploy/docker-compose.nsg.yml logs postgres
```

### Common Error Messages

| Error | Cause | Fix |
|---|---|---|
| `ECONNREFUSED on gateway` | OpenClaw host unreachable | Check macOS host is online, port 18789 open |
| `401 Unauthorized` | Bad API key or token | Regenerate agent API key in Paperclip UI |
| `Budget exceeded, agent paused` | Monthly spend hit limit | Increase budget or wait for next month |
| `Session restore failed` | Corrupted agent session | Reset session from Agent detail page |
| `Adapter not found: hermes_local` | Hermes plugin not loaded | Install `@henkey/hermes-paperclip-adapter` plugin |
