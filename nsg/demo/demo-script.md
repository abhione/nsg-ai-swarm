# NSG AI Swarm — Demo Video Script

7-scene narration script for the automated demo video. Each scene has a navigation
target, narration text, and expected screenshot content.

Duration target: 3-4 minutes total (~25-35 seconds per scene).

---

## Scene 1: Dashboard Overview

**Navigation:** `http://localhost:3100` (company dashboard)

**Screenshot timing:** After page load + 2 second settle

**Narration:**
"Welcome to the NSG Vision Care Marketing AI Swarm — powered by Paperclip. This is the command center for a fully autonomous marketing team. Nine AI agents work around the clock to grow patient acquisition for NSG vision care practices. On this dashboard, you can see real-time activity: agents completing tasks, campaigns being optimized, and content being published — all without human intervention. Let's take a closer look at how it all works."

**Expected on screen:** Dashboard with activity feed, agent status cards, cost summary widget, recent issues.

---

## Scene 2: Agent Roster

**Navigation:** Click "Agents" in sidebar (or navigate to `/agents`)

**Screenshot timing:** After agent list renders + 1 second

**Narration:**
"Here's the full team. Nine specialized agents, each with a clear role. Iris is the CEO, setting strategy and reviewing executive performance. Clarity, the CMO, manages campaigns and brand voice. Lens, the CTO, handles marketing technology. Under them, specialists like Focal for SEO, Spectrum for content writing, Prism for social media, and Retina for paid advertising. Optic tracks budgets as CFO, while Cornea produces analytics reports. Every agent has a defined place in the org chart and a specific adapter — OpenClaw for agents that need browser access, Hermes for text-heavy analytical work."

**Expected on screen:** Agent list showing all 9 agents with names, titles, adapter types, and status indicators.

---

## Scene 3: Issue Board

**Navigation:** Click "Issues" in sidebar (or navigate to `/issues`)

**Screenshot timing:** After issue list renders + 1 second

**Narration:**
"This is where work happens. Every task in the swarm is tracked as an issue — from drafting a blog post about blue light glasses to optimizing Google Ads bids for LASIK keywords. Issues flow through a clear lifecycle: open, in progress, and done. Agents pick up assigned work automatically on their heartbeat cycle. You can see Spectrum is currently writing next month's content calendar, while Retina just finished optimizing the pediatric eye care ad group. Every issue traces back to a company goal — nothing happens in isolation."

**Expected on screen:** Issue board with multiple issues in various states, assignee avatars, status badges.

---

## Scene 4: Org Chart

**Navigation:** Navigate to the company org chart view

**Screenshot timing:** After org chart renders + 2 seconds

**Narration:**
"The org chart shows how delegation flows. Iris, the CEO, delegates strategic initiatives to three executives — Lens, Clarity, and Optic. They break those down into specific tasks for their direct reports. When Iris says 'increase patient acquisition by forty percent this quarter,' Clarity turns that into a content calendar for Spectrum, social campaigns for Prism, and ad budgets for Retina. Results roll back up through the chain. This hierarchical structure keeps agents focused and aligned — every piece of work traces back to the company mission."

**Expected on screen:** Visual org tree with Iris at top, three executives, five specialists below.

---

## Scene 5: Agent Detail — Spectrum (Content Writer)

**Navigation:** Click on Spectrum agent (or navigate to agent detail page)

**Screenshot timing:** After agent detail loads + 1 second

**Narration:**
"Let's look at Spectrum, the content writer, in detail. You can see her current status — idle, waiting for the next heartbeat. Her recent runs show a successful blog post draft about children's eye health, an email campaign for annual exam reminders, and landing page copy for a new blue light glasses line. The run transcript shows exactly what the agent did: the prompt it received, the tools it used, and the content it produced. Token usage and cost are tracked per run — this blog post cost twelve cents in API calls. You have full visibility and control."

**Expected on screen:** Agent detail page showing status, recent runs list, run details/transcript, token usage.

---

## Scene 6: Cost Dashboard

**Navigation:** Navigate to Costs page

**Screenshot timing:** After cost data renders + 1 second

**Narration:**
"Cost control is critical when running nine agents continuously. The cost dashboard shows real-time spend across the entire swarm. This month, the team has used eighteen hundred dollars in API tokens — Spectrum and Retina are the highest spenders because content generation and ad analysis are token-intensive. The daily burn rate is about sixty dollars, well within our twenty-five hundred dollar monthly budget. If any agent approaches its individual limit, Paperclip automatically pauses it and alerts the board. No surprises, no runaway costs."

**Expected on screen:** Cost dashboard with per-agent breakdown, daily/weekly/monthly charts, budget utilization bars.

---

## Scene 7: Closing — The Power of Autonomous Marketing

**Navigation:** Return to dashboard

**Screenshot timing:** After dashboard loads + 1 second

**Narration:**
"That's the NSG Vision Care Marketing AI Swarm. Nine agents, working autonomously, executing a coordinated marketing strategy. Content gets written. Ads get optimized. Social media stays active. Reports get generated. All governed by clear budgets, approval gates, and full audit trails. The board maintains control while the swarm does the work. This is what autonomous marketing looks like — and it's running right now. Visit the GitHub repo to set up your own swarm with Paperclip."

**Expected on screen:** Dashboard showing healthy activity feed, green status indicators, cost summary.

---

## Production Notes

- Voice: en-US-AndrewNeural (Microsoft Edge TTS) — professional male voice
- Background music: None (clean demo)
- Resolution: 1920x1080
- Frame rate: 30fps for transitions, static screenshots held for narration duration
- Transitions: 0.5s crossfade between scenes
- Total duration target: 3-4 minutes
