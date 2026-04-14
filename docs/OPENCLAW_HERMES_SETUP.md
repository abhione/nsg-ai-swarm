# OpenClaw & Hermes Runtime Setup

Detailed guide for setting up agent runtimes for the NSG vision care marketing swarm.

## Part 1: OpenClaw Agents on MacStadium

OpenClaw agents run on macOS hosts. For production, we use MacStadium cloud Macs.
For development, any Mac with macOS Sonoma+ works.

### NSG Agents on OpenClaw

| Agent | Role | Why OpenClaw |
|---|---|---|
| Iris (CEO) | Executive strategy | Needs Telegram for board communication |
| Clarity (CMO) | Campaign management | Browser automation for competitor research |
| Prism (Social) | Social media | Browser for social platform management |
| Retina (PPC) | Paid advertising | Browser for Google/Meta Ads dashboards |

### 1.1 MacStadium Host Setup

```bash
# SSH into your MacStadium Mac Mini
ssh admin@<macstadium-ip>

# Install Homebrew (if not present)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js 20+
brew install node@22

# Install OpenClaw
npm install -g openclaw

# Verify installation
openclaw --version
```

### 1.2 OpenClaw Configuration (openclaw.json)

Each OpenClaw agent needs its own configuration. On the MacStadium host, create
configs for each agent:

```bash
mkdir -p ~/.openclaw/agents/{iris,clarity,prism,retina}
```

**Iris (CEO) — ~/.openclaw/agents/iris/openclaw.json:**

```json
{
  "agent": {
    "name": "Iris",
    "description": "CEO of NSG Vision Care Marketing"
  },
  "model": {
    "provider": "bedrock",
    "model": "us.anthropic.claude-sonnet-4-20250514-v1:0",
    "region": "us-east-1",
    "maxTokens": 8192
  },
  "telegram": {
    "botToken": "${IRIS_TELEGRAM_BOT_TOKEN}",
    "allowedChatIds": [
      "${NSG_BOARD_CHAT_ID}",
      "${NSG_EXECUTIVE_GROUP_ID}"
    ]
  },
  "gateway": {
    "port": 18789,
    "auth": {
      "token": "${OPENCLAW_GATEWAY_TOKEN}"
    }
  },
  "tools": {
    "browser": true,
    "fileSystem": true,
    "shell": false,
    "paperclipApi": {
      "url": "https://nsg-paperclip.fly.dev/api",
      "agentApiKey": "${IRIS_PAPERCLIP_API_KEY}"
    }
  },
  "heartbeat": {
    "soulPath": "./SOUL.md",
    "heartbeatPath": "./HEARTBEAT.md"
  }
}
```

**Prism (Social Media) — ~/.openclaw/agents/prism/openclaw.json:**

```json
{
  "agent": {
    "name": "Prism",
    "description": "Social Media Manager at NSG Vision Care Marketing"
  },
  "model": {
    "provider": "bedrock",
    "model": "us.anthropic.claude-sonnet-4-20250514-v1:0",
    "region": "us-east-1",
    "maxTokens": 4096
  },
  "telegram": {
    "botToken": "${PRISM_TELEGRAM_BOT_TOKEN}",
    "allowedChatIds": [
      "${NSG_SOCIAL_CHANNEL_ID}",
      "${NSG_MARKETING_GROUP_ID}"
    ]
  },
  "gateway": {
    "port": 18790,
    "auth": {
      "token": "${OPENCLAW_GATEWAY_TOKEN}"
    }
  },
  "tools": {
    "browser": true,
    "fileSystem": true,
    "shell": false,
    "paperclipApi": {
      "url": "https://nsg-paperclip.fly.dev/api",
      "agentApiKey": "${PRISM_PAPERCLIP_API_KEY}"
    }
  },
  "heartbeat": {
    "soulPath": "./SOUL.md",
    "heartbeatPath": "./HEARTBEAT.md"
  }
}
```

### 1.3 AWS Bedrock Credentials

OpenClaw agents use AWS Bedrock for Claude access. Configure IAM credentials on the MacStadium host:

```bash
# Option A: AWS credentials file
mkdir -p ~/.aws

cat > ~/.aws/credentials << 'EOF'
[default]
aws_access_key_id = AKIA...
aws_secret_access_key = ...
EOF

cat > ~/.aws/config << 'EOF'
[default]
region = us-east-1
EOF
```

```bash
# Option B: Environment variables (preferred for systemd services)
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_DEFAULT_REGION="us-east-1"
```

**Required IAM permissions:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-20250514-v1:0",
        "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-haiku-*"
      ]
    }
  ]
}
```

### 1.4 Starting OpenClaw Agents

```bash
# Start Iris (CEO)
cd ~/.openclaw/agents/iris
openclaw start --config openclaw.json --daemon

# Start Clarity (CMO)
cd ~/.openclaw/agents/clarity
openclaw start --config openclaw.json --daemon

# Start Prism (Social Media)
cd ~/.openclaw/agents/prism
openclaw start --config openclaw.json --daemon

# Start Retina (PPC)
cd ~/.openclaw/agents/retina
openclaw start --config openclaw.json --daemon
```

For production, use launchd (macOS service manager):

```bash
# Create launchd plist for each agent
cat > ~/Library/LaunchAgents/com.nsg.openclaw.iris.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.nsg.openclaw.iris</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/openclaw</string>
        <string>start</string>
        <string>--config</string>
        <string>/Users/admin/.openclaw/agents/iris/openclaw.json</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/admin/.openclaw/logs/iris.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/admin/.openclaw/logs/iris.err</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>AWS_DEFAULT_REGION</key>
        <string>us-east-1</string>
    </dict>
</dict>
</plist>
EOF

# Load the service
launchctl load ~/Library/LaunchAgents/com.nsg.openclaw.iris.plist

# Check status
launchctl list | grep nsg
```

### 1.5 Connecting OpenClaw to Paperclip

In the Paperclip UI, configure each OpenClaw agent's adapter:

1. Go to **Agents** -> Select agent (e.g., Iris)
2. Click **Settings** -> **Adapter Configuration**
3. Set:
   - **Adapter Type**: `openclaw_gateway`
   - **Gateway URL**: `wss://<macstadium-ip>:18789` (Iris) or `:18790` (Prism), etc.
   - **Auth Token**: The `gateway.auth.token` value from openclaw.json
4. Save and test with a manual wake

### 1.6 Device Pairing (First Connection)

The first time Paperclip connects to an OpenClaw gateway:

1. Paperclip sends a pairing request via WebSocket
2. OpenClaw shows the pairing request in its logs
3. Approve the device:

```bash
# On the MacStadium host
openclaw devices approve --latest --url "ws://127.0.0.1:18789" \
  --token "<gateway-auth-token>"
```

4. Paperclip stores the `devicePrivateKeyPem` for future connections
5. Subsequent connections authenticate automatically

---

## Part 2: Hermes Agents

Hermes agents are lightweight HTTP API services ideal for text-heavy analytical work.

### NSG Agents on Hermes

| Agent | Role | Why Hermes |
|---|---|---|
| Lens (CTO) | Marketing technology | Stateless analysis, no browser needed |
| Focal (SEO) | SEO specialist | Keyword research via API, no GUI needed |
| Spectrum (Content) | Content writer | Pure text generation |
| Optic (CFO) | Budget/ROI | Financial analysis, spreadsheet generation |
| Cornea (Analytics) | Reporting | Data aggregation and report writing |

### 2.1 Hermes Server Setup

```bash
# Clone the Hermes adapter repo
git clone https://github.com/henkey/hermes-paperclip-adapter.git
cd hermes-paperclip-adapter

# Install dependencies
npm install

# Build
npm run build
```

### 2.2 Hermes Configuration

**config.yaml:**

```yaml
# Hermes Agent Runtime — NSG Configuration
server:
  host: 0.0.0.0
  port: 8642

model:
  provider: anthropic
  default_model: claude-sonnet-4-20250514
  fast_model: claude-haiku-3-20250307
  max_tokens: 8192
  temperature: 0.3

# Smart routing: use fast_model for simple tasks
routing:
  use_fast_model_for:
    - status_update
    - formatting
    - simple_lookup
  use_default_model_for:
    - analysis
    - content_creation
    - research
    - reporting

agents:
  lens-cto:
    soul_path: ./souls/lens.md
    tools: [paperclip_api, web_search, file_write, shell_exec]
    max_tokens: 8192

  focal-seo:
    soul_path: ./souls/focal.md
    tools: [paperclip_api, web_search, file_write]
    max_tokens: 4096

  spectrum-content:
    soul_path: ./souls/spectrum.md
    tools: [paperclip_api, web_search, file_write]
    max_tokens: 8192

  optic-cfo:
    soul_path: ./souls/optic.md
    tools: [paperclip_api, file_write, analytics_read]
    max_tokens: 4096

  cornea-analytics:
    soul_path: ./souls/cornea.md
    tools: [paperclip_api, file_write, web_search, analytics_read]
    max_tokens: 8192

paperclip:
  url: https://nsg-paperclip.fly.dev/api
  # Agent API keys are per-agent, set via environment variables

logging:
  level: info
  format: json
  file: /var/log/hermes/hermes.log
```

**.env:**

```bash
# Anthropic API key (for direct API access)
ANTHROPIC_API_KEY=sk-ant-...

# OR AWS Bedrock (for Bedrock access)
# AWS_ACCESS_KEY_ID=AKIA...
# AWS_SECRET_ACCESS_KEY=...
# AWS_DEFAULT_REGION=us-east-1
# HERMES_MODEL_PROVIDER=bedrock

# Hermes server
HERMES_PORT=8642
HERMES_HOST=0.0.0.0

# Paperclip connection
PAPERCLIP_URL=https://nsg-paperclip.fly.dev/api

# Per-agent Paperclip API keys
LENS_PAPERCLIP_API_KEY=pak_...
FOCAL_PAPERCLIP_API_KEY=pak_...
SPECTRUM_PAPERCLIP_API_KEY=pak_...
OPTIC_PAPERCLIP_API_KEY=pak_...
CORNEA_PAPERCLIP_API_KEY=pak_...

# Hermes auth (Paperclip uses this to authenticate requests to Hermes)
HERMES_AUTH_TOKEN=herm_...
```

### 2.3 Starting the Hermes Server

```bash
# Development
npm run dev

# Production
npm start

# Or with PM2 for process management
pm2 start npm --name "hermes-nsg" -- start
pm2 save
pm2 startup
```

### 2.4 Docker Deployment (Recommended for Production)

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
ENV NODE_ENV=production
EXPOSE 8642
CMD ["node", "dist/server.js"]
```

Deploy to Fly.io:

```bash
fly launch --name nsg-hermes --region iad
fly secrets set ANTHROPIC_API_KEY=sk-ant-...
fly secrets set HERMES_AUTH_TOKEN=herm_...
fly secrets set LENS_PAPERCLIP_API_KEY=pak_...
# ... set all agent keys
fly deploy
```

### 2.5 Connecting Hermes to Paperclip

Install the Hermes adapter plugin in Paperclip:

```bash
# In the Paperclip repo, install the adapter plugin
cd nsg-ai-swarm

# Option A: From npm
npm install @henkey/hermes-paperclip-adapter

# Option B: From local path (development)
# Add to ~/.paperclip/adapter-plugins.json:
# { "adapters": [{ "package": "file:../hermes-paperclip-adapter" }] }
```

Then configure each Hermes agent in Paperclip UI:

1. Go to **Agents** -> Select agent (e.g., Focal)
2. Click **Settings** -> **Adapter Configuration**
3. Set:
   - **Adapter Type**: `hermes_local`
   - **Hermes URL**: `https://nsg-hermes.fly.dev` (or `http://localhost:8642` for local)
   - **Auth Token**: The `HERMES_AUTH_TOKEN` value from .env
4. Save

---

## Part 3: Testing Agent Connectivity

### Test OpenClaw Agents

```bash
# Test WebSocket connectivity
# Install wscat: npm install -g wscat
wscat -c "wss://<macstadium-ip>:18789" \
  -H "x-openclaw-token: <gateway-token>"

# Expected: WebSocket connection opens, no immediate error

# Test from Paperclip (manual wake)
curl -X POST http://localhost:3100/api/agents/<iris-agent-id>/wake \
  -H "Cookie: $PAPERCLIP_COOKIE"

# Check the run result
curl -s http://localhost:3100/api/agents/<iris-agent-id>/runs?limit=1 | jq '.[0].status'
# Expected: "succeeded"
```

### Test Hermes Agents

```bash
# Test Hermes health endpoint
curl https://nsg-hermes.fly.dev/health
# Expected: {"status": "ok"}

# Test a direct agent run
curl -X POST https://nsg-hermes.fly.dev/run \
  -H "Authorization: Bearer herm_..." \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "focal-seo",
    "prompt": "What are the top 3 SEO keywords for pediatric eye care in Atlanta, GA?",
    "tools": ["web_search"]
  }'

# Expected: JSON response with results and token usage

# Test from Paperclip (manual wake)
curl -X POST http://localhost:3100/api/agents/<focal-agent-id>/wake \
  -H "Cookie: $PAPERCLIP_COOKIE"

# Check the run result
curl -s http://localhost:3100/api/agents/<focal-agent-id>/runs?limit=1 | jq '.[0].status'
# Expected: "succeeded"
```

### Full Swarm Connectivity Check

```bash
#!/bin/bash
# nsg-connectivity-check.sh — Verify all 9 agents are reachable

PAPERCLIP_URL="http://localhost:3100"
COMPANY_ID="<your-company-id>"

echo "=== NSG AI Swarm Connectivity Check ==="
echo ""

# Get all agents
agents=$(curl -s "$PAPERCLIP_URL/api/companies/$COMPANY_ID/agents")

echo "$agents" | jq -r '.[] | "\(.name) (\(.adapterType)) — \(.runtimeState.status // "unknown")"'

echo ""
echo "=== Waking all agents for connectivity test ==="

echo "$agents" | jq -r '.[].id' | while read agent_id; do
  name=$(echo "$agents" | jq -r ".[] | select(.id == \"$agent_id\") | .name")
  echo "Waking $name..."
  curl -s -X POST "$PAPERCLIP_URL/api/agents/$agent_id/wake" \
    -H "Cookie: $PAPERCLIP_COOKIE" > /dev/null
done

echo ""
echo "Waiting 60 seconds for runs to complete..."
sleep 60

echo ""
echo "=== Results ==="
echo "$agents" | jq -r '.[].id' | while read agent_id; do
  name=$(echo "$agents" | jq -r ".[] | select(.id == \"$agent_id\") | .name")
  status=$(curl -s "$PAPERCLIP_URL/api/agents/$agent_id/runs?limit=1" | jq -r '.[0].status')
  echo "$name: $status"
done
```

---

## Part 4: Monitoring and Health Checks

### Paperclip Dashboard

The Paperclip UI dashboard (`http://localhost:3100`) shows:
- Agent online/offline status
- Recent run history with success/failure
- Token cost tracking per agent
- Activity feed with all agent actions

### Log Monitoring

**Paperclip server logs:**
```bash
# Docker
docker logs -f nsg-paperclip

# Local dev
# Logs output to terminal running `pnpm dev`
```

**OpenClaw agent logs (MacStadium):**
```bash
# Per-agent logs
tail -f ~/.openclaw/logs/iris.log
tail -f ~/.openclaw/logs/prism.log

# Gateway logs
tail -f ~/.openclaw/logs/gateway.log
```

**Hermes server logs:**
```bash
# Docker
docker logs -f nsg-hermes

# PM2
pm2 logs hermes-nsg

# Direct
tail -f /var/log/hermes/hermes.log
```

### Health Check Endpoints

| Service | Endpoint | Expected |
|---|---|---|
| Paperclip | `GET /api/health` | `{"status": "ok"}` |
| Hermes | `GET /health` | `{"status": "ok"}` |
| OpenClaw GW | WebSocket handshake on `:18789` | Connection opens |

### Alerting

Set up basic uptime monitoring:

```bash
# Simple cron-based health check (add to MacStadium host)
# crontab -e
*/5 * * * * curl -sf http://localhost:3100/api/health > /dev/null || echo "Paperclip down" | mail -s "NSG Alert" ops@nsg.com
*/5 * * * * curl -sf http://hermes-host:8642/health > /dev/null || echo "Hermes down" | mail -s "NSG Alert" ops@nsg.com
```

For production, use:
- **Fly.io built-in health checks** for Paperclip and Hermes
- **UptimeRobot** or **Better Uptime** for external monitoring
- **Paperclip's budget alerts** for cost anomaly detection

### Cost Monitoring

Track daily spend across the swarm:

```bash
# Get current month's cost summary
curl -s http://localhost:3100/api/companies/<company-id>/costs/summary | jq '{
  total_usd: .totalCostUsd,
  by_agent: [.byAgent[] | {name: .agentName, usd: .costUsd}],
  daily_avg: .dailyAverageUsd,
  projected_monthly: .projectedMonthlyUsd
}'
```

Expected healthy ranges for NSG:
- Daily spend: $30-70
- Per-agent daily: $3-15
- Monthly total: $900-2100
- Highest spenders: Spectrum (content generation), Retina (ads analysis)
- Lowest spenders: Cornea (infrequent reports), Optic (periodic reviews)
