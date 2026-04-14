```
 _   _ ____   ____      _    ___   ____                                
| \ | / ___| / ___|    / \  |_ _| / ___|_      ____ _ _ __ _ __ ___   
|  \| \___ \| |  _    / _ \  | |  \___ \ \ /\ / / _` | '__| '_ ` _ \  
| |\  |___) | |_| |  / ___ \ | |   ___) \ V  V / (_| | |  | | | | | | 
|_| \_|____/ \____| /_/   \_\___|  |____/ \_/\_/ \__,_|_|  |_| |_| |_| 
                                                                        
        12-Agent AI Workforce for Vision Care Marketing
```

# NSG AI Swarm

**A 12-agent AI workforce that automates marketing operations across hundreds of ophthalmology, optometry, and optical practices.**

Built by [National Strategic Group](https://www.nationalstrategicgroup.com) on the [Paperclip](https://github.com/paperclipai/paperclip) orchestration platform. Powered by [Hermes](https://nousresearch.com) and [OpenClaw](https://openclaw.ai) runtimes.

---

## What This Does

NSG manages marketing for 1,000+ eye care practices. This swarm replaces manual marketing ops with 12 specialized AI agents that:

- **Profile every practice** — demographics, payer mix, procedure focus, competitive landscape
- **Generate review campaigns** — automated sequences that push practices from 4.2 to 4.8 stars
- **Write and deploy content** — social posts, email blasts, patient recall texts, ad copy
- **Monitor reputation 24/7** — catch negative reviews within minutes, draft responses
- **Audit SEO + AI readiness** — ensure practices appear in ChatGPT, Perplexity, Google AI Overviews
- **Produce performance reports** — monthly decks with review velocity, patient acquisition cost, conversion rates
- **Prep and follow up on meetings** — agendas, notes, action items for every practice check-in

One swarm instance handles all practices. Agents share context, learn patterns across the portfolio, and escalate to humans only when needed.

---

## The 12-Agent Org Chart

```
                            ┌─────────────┐
                            │    ATLAS    │
                            │ Chief AI    │
                            │ Officer     │
                            └──────┬──────┘
                   ┌───────────────┼───────────────┐
                   │               │               │
            ┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐
            │   ATHENA    │ │   APOLLO    │ │   ORACLE    │
            │ VP Client   │ │ VP Campaign │ │ VP Analytics│
            │ Intelligence│ │ Operations  │ │ & Reporting │
            └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
              ┌────┴────┐     ┌────┴────┐     ┌────┴────┐
              │         │     │         │     │         │
          ┌───┴───┐ ┌───┴───┐ ┌───┴───┐ ┌───┴───┐ ┌───┴───┐ ┌───┴───┐
          │ SCOUT │ │ ECHO  │ │ MUSE  │ │ QUILL │ │ FLUX  │ │SENTINEL│
          │Client │ │Trans- │ │Campaign│ │Content│ │ Data  │ │ Alert  │
          │Profiler│ │Analyst│ │Strate-│ │Genera-│ │Aggre- │ │Monitor │
          └───────┘ └───────┘ │ gist  │ │ tor   │ │gator  │ └────────┘
                              └───────┘ └───────┘ └───────┘
                                                         ┌────────┐ ┌────────┐
                                                         │COMPASS │ │ RELAY  │
                                                         │SEO     │ │Meeting │
                                                         │Auditor │ │Assist  │
                                                         └────────┘ └────────┘
```

| Agent | Role | Department | Reports To |
|-------|------|-----------|------------|
| **Atlas** | Chief AI Officer | Executive | Eugene Shatsman (human) |
| **Athena** | VP Client Intelligence | Client Research | Atlas |
| **Apollo** | VP Campaign Operations | Campaigns | Atlas |
| **Oracle** | VP Analytics & Reporting | Data & Analytics | Atlas |
| **Scout** | Client Profiler | Client Research | Athena |
| **Echo** | Transcript Analyst | Client Research | Athena |
| **Muse** | Campaign Strategist | Campaigns | Apollo |
| **Quill** | Content Generator | Campaigns | Apollo |
| **Flux** | Data Aggregator | Data & Analytics | Oracle |
| **Sentinel** | Alert Monitor | Data & Analytics | Oracle |
| **Compass** | SEO Auditor | Data & Analytics | Oracle |
| **Relay** | Meeting Assistant | Client Research | Athena |

---

## Quick Start

### Prerequisites

- Node.js 20+
- A running Paperclip instance (see [upstream repo](https://github.com/paperclipai/paperclip))
- API key for your Paperclip instance

### 1. Clone and configure

```bash
git clone https://github.com/nsg-ai/nsg-ai-swarm.git
cd nsg-ai-swarm
cp .env.example .env
# Edit .env with your PAPERCLIP_API_URL and PAPERCLIP_API_KEY
```

### 2. Run the setup script

```bash
cd nsg
chmod +x setup.sh
./setup.sh
```

This creates the NSG AI Operations company, all 12 agents, 5 goals, and 16 starter issues across 3 pilot practices (Levin Eye Care, Starwood Vision, Pacific Eye Associates).

### 3. Start workers

From the Paperclip root:

```bash
pnpm dev
```

Then open the dashboard at `http://localhost:3100`. You'll see the NSG AI Operations company with all agents ready.

### 4. Connect agent runtimes

Agents can run on:
- **Hermes** (Nous Research) — via `hermes_local` adapter plugin
- **OpenClaw** — via `openclaw` adapter
- **Claude** — via built-in `claude` adapter
- **Any OpenAI-compatible endpoint** — via `openai` adapter

Configure per-agent model assignments in the dashboard or in `nsg/config.yaml`.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     NSG AI SWARM                                 │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  Atlas   │  │  Athena  │  │  Apollo  │  │  Oracle  │       │
│  │ (exec)   │  │ (client) │  │ (campaign│  │ (data)   │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│       │              │              │              │              │
│  ┌────┴──────────────┴──────────────┴──────────────┴────┐       │
│  │              Paperclip Orchestration Layer            │       │
│  │   Issues · Goals · Budgets · Approvals · Activity    │       │
│  └────┬──────────────┬──────────────┬───────────────────┘       │
│       │              │              │                            │
│  ┌────┴─────┐  ┌─────┴────┐  ┌─────┴────┐                     │
│  │  Hermes  │  │ OpenClaw │  │  Claude  │  Agent Runtimes     │
│  │  Runtime │  │  Runtime │  │  API     │                      │
│  └──────────┘  └──────────┘  └──────────┘                      │
└──────────────────────────────────────────────────────────────────┘
          │              │              │
          ▼              ▼              ▼
   ┌─────────────────────────────────────────┐
   │         External Services & Data        │
   │                                         │
   │  Google Business Profile API            │
   │  Google Analytics 4                     │
   │  Facebook/Instagram Graph API           │
   │  Birdeye / Podium (review platforms)    │
   │  Mailchimp / Klaviyo                    │
   │  Practice Management Systems            │
   │  EYEGPT Knowledge Base                  │
   └─────────────────────────────────────────┘
```

---

## File Structure

```
nsg/
├── agents/                    # 12 agent persona files
│   ├── atlas.md              # Chief AI Officer
│   ├── athena.md             # VP Client Intelligence
│   ├── apollo.md             # VP Campaign Operations
│   ├── oracle.md             # VP Analytics & Reporting
│   ├── scout.md              # Client Profiler
│   ├── echo.md               # Transcript Analyst
│   ├── muse.md               # Campaign Strategist
│   ├── quill.md              # Content Generator
│   ├── flux.md               # Data Aggregator
│   ├── sentinel.md           # Alert Monitor
│   ├── compass.md            # SEO Auditor
│   └── relay.md              # Meeting Assistant
├── workflows/                 # Workflow templates
│   ├── new-practice-onboarding.yaml
│   ├── monthly-review-campaign.yaml
│   ├── patient-recall-sequence.yaml
│   ├── seo-audit-cycle.yaml
│   └── quarterly-performance-report.yaml
├── config.yaml               # Default NSG configuration
└── setup.sh                  # Idempotent setup script
```

---

## Workflows

| Workflow | Trigger | Agents Involved | Cadence |
|----------|---------|----------------|---------|
| New Practice Onboarding | Practice signs contract | Scout → Athena → Muse → Atlas | One-time |
| Monthly Review Campaign | 1st of month | Muse → Quill → Sentinel | Monthly |
| Patient Recall Sequence | Lapsed patient threshold hit | Flux → Muse → Quill | Continuous |
| SEO Audit Cycle | Quarterly | Compass → Oracle → Atlas | Quarterly |
| Quarterly Performance Report | End of quarter | Flux → Oracle → Relay → Atlas | Quarterly |

---

## Key Metrics the Swarm Tracks

- **Review Velocity** — new Google/Yelp reviews per practice per month (target: 15+)
- **Average Star Rating** — per-practice and portfolio-wide (target: 4.7+)
- **Patient Recall Rate** — % of lapsed patients (18+ months) reactivated (target: 12%)
- **AI Answer Engine Citations** — practice appearances in ChatGPT, Perplexity, Google AI Overviews
- **Google Business Profile Completeness** — photo count, Q&A, services, attributes (target: 95%+)
- **Premium Procedure Conversion** — LASIK/cataract/glaucoma consult-to-surgery rate
- **Email Open Rate** — patient communication engagement (target: 28%+)
- **Social Engagement Rate** — likes/comments/shares per post (target: 3.5%+)
- **Cost Per Patient Acquired** — total marketing spend / new patients (target: <$45)
- **Website Organic Traffic** — monthly sessions from search (target: 15% YoY growth)

---

## Connecting to Runtimes

### Hermes (Nous Research)

Install the Hermes adapter plugin:

```bash
# Via the Paperclip adapter manager UI, or:
npm install @henkey/hermes-paperclip-adapter
```

Then assign agents to `hermes_local` in the dashboard. Hermes excels at the analytical agents (Scout, Echo, Flux, Compass) due to strong instruction-following and tool use.

### OpenClaw

OpenClaw agents connect via the built-in adapter. Best for autonomous campaign execution (Muse, Quill, Apollo) where agents need to chain multiple tools.

```yaml
# In nsg/config.yaml
agent_defaults:
  atlas:
    adapter: openclaw
    model: openclaw-latest
```

---

## Upstream

This repo is a fork of [paperclipai/paperclip](https://github.com/paperclipai/paperclip) — the open-source orchestration platform for AI agent companies. The core platform provides:

- Company/agent/goal/issue management
- Budget tracking and governance
- Agent adapter system (plug in any LLM)
- Dashboard UI for monitoring

The `nsg/` directory contains all NSG-specific configuration layered on top.

---

## Screenshots & Demo

> Coming soon — dashboard screenshots showing the NSG AI Swarm in action across pilot practices.

| View | Description |
|------|-------------|
| Dashboard | All 12 agents, active issues, budget burn |
| Practice Board | Per-practice Kanban with marketing tasks |
| Review Campaign | Monthly review blitz execution timeline |
| Performance Deck | Auto-generated quarterly report |

---

## About NSG

[National Strategic Group](https://www.nationalstrategicgroup.com) is the leading marketing agency for vision care practices. Led by Eugene Shatsman, NSG manages marketing for 1,000+ ophthalmology, optometry, and optical practices across the US. Services include reputation management, social media, websites, email/text marketing, SEO, strategy consulting, and analytics. NSG is also building **EYEGPT** — an AI knowledge platform for eye care.

---

## License

MIT — see [LICENSE](LICENSE)
