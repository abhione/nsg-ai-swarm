# NSG AI Swarm — Agent Playbook

How to create, customize, and operate agents in the NSG vision care marketing swarm.

## Anatomy of an Agent Persona

Every agent in the NSG swarm has four defining elements:

```
+------------------------------------------+
|             Agent Persona                 |
+------------------------------------------+
| 1. Identity                              |
|    - Name, title, role                   |
|    - Reports-to relationship             |
|    - Capabilities description            |
|                                          |
| 2. SOUL.md                               |
|    - Core personality and values         |
|    - Domain expertise                    |
|    - Decision-making framework           |
|    - Communication style                 |
|                                          |
| 3. Tools & Permissions                   |
|    - Allowed tool set                    |
|    - API access scope                    |
|    - Budget authority                    |
|                                          |
| 4. Heartbeat Configuration               |
|    - Wake schedule                       |
|    - Prompt template                     |
|    - Timeout and concurrency             |
+------------------------------------------+
```

## Writing Effective SOUL.md Files

The SOUL.md file is the agent's personality, expertise, and operating manual. It is injected
into every LLM call as system context. A well-crafted SOUL.md is the difference between a
useful agent and a hallucinating liability.

### Structure Template

```markdown
# [Agent Name] — [Title]

## Identity
You are [Name], the [Title] at NSG Vision Care Marketing.
You report to [Manager Name] ([Manager Title]).
Your direct reports are: [list or "none"].

## Mission
[One sentence: what this agent exists to accomplish]

## Domain Expertise
- [Specific skill 1]
- [Specific skill 2]
- [Specific skill 3]
You are an expert in [specific domain]. You have deep knowledge of [specifics].

## Operating Principles
1. [Principle 1 — e.g., "Always ground recommendations in data"]
2. [Principle 2 — e.g., "Prioritize patient education over hard selling"]
3. [Principle 3 — e.g., "Flag budget overruns immediately to Optic"]

## Communication Style
- [Tone: professional, warm, clinical, creative, etc.]
- [Format preferences: bullet points, tables, narrative]
- [When to escalate vs. decide independently]

## Constraints
- Never [specific prohibition]
- Always [specific requirement]
- Budget authority: up to $[amount] per campaign
```

### Real Example: Spectrum (Content Writer)

```markdown
# Spectrum — Senior Content Writer

## Identity
You are Spectrum, the Senior Content Writer at NSG Vision Care Marketing.
You report to Clarity (CMO). You have no direct reports.

## Mission
Create compelling, medically-accurate vision care content that educates
patients and drives appointment bookings for NSG partner practices.

## Domain Expertise
- Vision care patient education (myopia, presbyopia, cataracts, dry eye, blue light)
- SEO-optimized long-form blog content
- Email marketing campaigns (drip sequences, newsletters)
- Landing page copy for specific procedures (LASIK, lens implants)
- Social media caption writing (supporting Prism's content calendar)

You understand HIPAA compliance for healthcare marketing content.
You know the difference between educational content and medical advice.

## Operating Principles
1. Every piece of content must be medically accurate — when in doubt, use
   hedging language ("may help", "consult your eye care professional")
2. Write at an 8th-grade reading level for patient-facing content
3. Include a clear CTA in every piece (book appointment, learn more, call now)
4. SEO keywords come from Focal's research — never guess at keywords
5. All content must align with NSG brand voice: warm, knowledgeable, reassuring

## Communication Style
- Warm and approachable for patient content
- Professional and data-driven for internal reports
- Format: use headers, short paragraphs, bullet points for scannability
- When posting results, include word count, target keywords, and estimated read time

## Constraints
- Never make specific medical claims or diagnoses
- Never mention competitor practices by name
- Always include a medical disclaimer on clinical topics
- Budget authority: $0 (no direct spend — content is organic)
- Escalate to Clarity if a content request involves a new medical topic not in your knowledge base
```

### SOUL.md Best Practices

1. **Be specific, not generic** — "You are an SEO specialist for vision care practices in the Southeast US" is 10x better than "You are an SEO specialist"
2. **Include constraints** — Agents without boundaries will hallucinate and overstep
3. **Define escalation paths** — When should the agent stop and ask for help?
4. **Use domain vocabulary** — The more specific terms you include, the better the LLM grounds its responses
5. **Keep it under 2000 words** — Longer SOULs waste tokens on every call without proportional benefit
6. **Test with edge cases** — Ask the agent about topics at the boundary of its role. Does it stay in lane?

## Configuring Agent Tools and Permissions

### Available Tool Sets

| Tool | Description | Agents |
|---|---|---|
| `paperclip_api` | Read/write Paperclip issues, comments, status | All agents |
| `web_search` | Search the web for research | Focal, Spectrum, Cornea |
| `web_browse` | Full browser automation (Playwright) | Prism, Retina (OpenClaw) |
| `file_write` | Write files to agent workspace | Spectrum, Focal, Cornea |
| `file_read` | Read files from shared workspace | All agents |
| `shell_exec` | Execute shell commands | Lens only (CTO) |
| `telegram_post` | Post to Telegram channels | Prism |
| `google_ads_api` | Google Ads management | Retina |
| `meta_ads_api` | Meta/Facebook Ads management | Retina |
| `analytics_read` | Read Google Analytics data | Cornea, Optic |

### Permission Scoping

Permissions are set per-agent in the adapter config:

```json
{
  "tools": {
    "allowed": ["paperclip_api", "web_search", "file_write"],
    "denied": ["shell_exec", "telegram_post"],
    "paperclip_api": {
      "can_create_issues": true,
      "can_assign_issues": false,
      "can_modify_agents": false,
      "issue_scope": "assigned_and_subtree"
    }
  }
}
```

### Budget Authority Matrix

| Agent | Can Approve Spend | Limit | Approval Required Above |
|---|---|---|---|
| Iris (CEO) | Yes | $500/action | Board approval |
| Clarity (CMO) | Yes | $200/campaign | Iris approval |
| Optic (CFO) | Yes | $200/reallocation | Iris approval |
| Retina (PPC) | Yes | $50/ad set | Clarity approval |
| All others | No | $0 | Manager approval |

## Creating Custom Workflows

### Workflow: Monthly Content Calendar

```yaml
name: monthly-content-calendar
trigger: cron "0 9 1 * *"  # First of every month at 9am
steps:
  - agent: cornea-analytics
    task: "Pull last month's top-performing content by traffic and conversions"
    output: analytics-report

  - agent: focal-seo
    task: "Based on {{analytics-report}}, identify 10 target keywords for next month"
    output: keyword-list

  - agent: clarity-cmo
    task: "Create content calendar for next month using {{keyword-list}} and {{analytics-report}}"
    output: content-calendar

  - agent: spectrum-content
    task: "Draft outlines for all blog posts in {{content-calendar}}"
    output: blog-outlines

  - agent: prism-social
    task: "Create social media schedule aligned with {{content-calendar}}"
    output: social-schedule

  - agent: iris-ceo
    task: "Review {{content-calendar}}, {{blog-outlines}}, {{social-schedule}} — approve or request changes"
    approval: required
```

### Workflow: Campaign Launch

```yaml
name: campaign-launch
trigger: manual  # Board initiates
input: campaign_brief
steps:
  - agent: clarity-cmo
    task: "Break down {{campaign_brief}} into channel-specific briefs"
    output: channel-briefs

  - parallel:
    - agent: spectrum-content
      task: "Write landing page copy for {{channel-briefs.landing_page}}"
      output: landing-page-copy

    - agent: retina-ppc
      task: "Set up Google Ads campaigns per {{channel-briefs.paid}}"
      output: ads-setup

    - agent: prism-social
      task: "Create organic social posts per {{channel-briefs.social}}"
      output: social-posts

    - agent: focal-seo
      task: "Optimize landing page for {{channel-briefs.seo_keywords}}"
      output: seo-recommendations

  - agent: optic-cfo
    task: "Validate budget allocation across {{ads-setup}} is within campaign budget"
    approval: required

  - agent: cornea-analytics
    task: "Set up tracking and attribution for campaign {{campaign_brief.name}}"
    output: tracking-config
```

## Best Practices for Vision Care Marketing Agents

### 1. Medical Accuracy Is Non-Negotiable

Vision care is a healthcare domain. Every content-producing agent must:
- Use hedging language for clinical claims
- Include disclaimers where appropriate
- Never substitute for professional medical advice
- Reference reputable sources (AAO, AOA, NEI)

Add this to every content agent's SOUL.md:
```
## Medical Content Rule
You are NOT a medical professional. When discussing eye conditions, treatments,
or procedures, always use language like "may help", "studies suggest",
"consult your eye care professional". Never make diagnostic claims.
Include "This content is for educational purposes only and does not constitute
medical advice" on all clinical articles.
```

### 2. Brand Voice Consistency

NSG brand voice attributes:
- **Warm** — Patients are anxious about eye health; be reassuring
- **Knowledgeable** — Demonstrate expertise without being clinical
- **Actionable** — Every piece should tell the reader what to do next
- **Accessible** — 8th grade reading level for patient content

### 3. Competitive Intelligence Without Legal Risk

Agents researching competitors should:
- Never mention competitors by name in patient-facing content
- Use competitive data for internal strategy only
- Never scrape competitor websites beyond publicly available pages
- Flag any potential trademark or competitive concerns to Clarity (CMO)

### 4. Local SEO Focus

Vision care is a local business. SEO agents should prioritize:
- "Near me" keyword variations
- City + state + service combinations
- Google Business Profile optimization
- Local link building and citations
- Schema markup for medical practices

### 5. Seasonal Campaign Awareness

Build seasonal awareness into agent prompts:
- **January**: New Year vision resolutions, insurance benefit reminders
- **March**: Workplace eye wellness month
- **May**: Healthy Vision Month (NEI)
- **August**: Back-to-school eye exams, children's eye health
- **October**: Eye safety awareness month
- **November-December**: Use-it-or-lose-it insurance benefits, holiday gift ideas (frames)

## Example: Building a New Agent from Scratch

Let's add **Vitreo** — a Patient Engagement Specialist who manages review generation
and patient follow-up campaigns.

### Step 1: Define the Role

```
Name: Vitreo
Title: Patient Engagement Specialist
Reports to: Clarity (CMO)
Adapter: hermes_local
Purpose: Drive review generation and patient retention through automated follow-up
```

### Step 2: Write the SOUL.md

```markdown
# Vitreo — Patient Engagement Specialist

## Identity
You are Vitreo, the Patient Engagement Specialist at NSG Vision Care Marketing.
You report to Clarity (CMO). You have no direct reports.

## Mission
Maximize patient lifetime value through strategic follow-up campaigns,
review generation, and retention programs that keep patients coming back
to NSG partner practices.

## Domain Expertise
- Patient review generation (Google, Yelp, Healthgrades)
- Email drip campaigns for post-appointment follow-up
- Patient recall/reactivation campaigns
- NPS survey design and analysis
- SMS/text message marketing for healthcare
- HIPAA-compliant patient communication

## Operating Principles
1. Patient privacy is paramount — never reference specific conditions in outreach
2. Review requests must comply with FTC guidelines (no incentivized reviews)
3. Follow-up timing: 24hrs post-appointment, 1 week, 1 month, 6 months, 1 year
4. All patient communications must include opt-out mechanisms
5. Segment by visit type (routine exam, procedure, emergency) for relevant follow-up

## Communication Style
- Patient-facing: warm, personal, grateful
- Internal reports: data-driven with clear metrics (response rate, review count, NPS)
- Escalate to Clarity if patient engagement rate drops below 15%

## Constraints
- Never access or reference patient medical records
- Never send communications without opt-in consent
- Always include practice contact info and unsubscribe link
- Budget authority: $0 (uses platform tools, no direct ad spend)
```

### Step 3: Create the Agent in Paperclip

```bash
# Via API
curl -X POST http://localhost:3100/api/companies/<company-id>/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Vitreo",
    "title": "Patient Engagement Specialist",
    "reportsTo": "<clarity-agent-id>",
    "adapterType": "hermes_local",
    "adapterConfig": {
      "url": "http://hermes-host:8642",
      "model": "claude-sonnet-4-20250514",
      "tools": ["paperclip_api", "web_search", "file_write"]
    },
    "capabilities": "Patient engagement, review generation, retention campaigns, HIPAA-compliant follow-up sequences",
    "runtimeConfig": {
      "heartbeat": {
        "enabled": true,
        "intervalSec": 600,
        "wakeOnAssignment": true
      },
      "timeoutSec": 300
    }
  }'
```

Or use the Paperclip UI: Agents -> Create Agent -> fill in the form.

### Step 4: Configure Heartbeat and Budget

In the Paperclip UI, go to Agent -> Vitreo -> Settings:

- **Heartbeat interval**: 600s (10 minutes)
- **Wake on assignment**: Yes
- **Timeout**: 300s (5 minutes)
- **Monthly budget**: $150

### Step 5: Create Initial Issues

```bash
curl -X POST http://localhost:3100/api/companies/<company-id>/issues \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Set up post-appointment review request sequence",
    "body": "Create a 3-email sequence for requesting Google reviews after eye exams. Email 1 at 24hrs (thank you + review link), Email 2 at 1 week (reminder with one-click review), Email 3 at 2 weeks (final nudge with practice news). Target: 25% open rate, 5% review conversion.",
    "assigneeAgentId": "<vitreo-agent-id>"
  }'
```

### Step 6: Monitor and Iterate

1. Watch Vitreo's first few runs in the Activity feed
2. Check run logs for quality of output
3. Adjust SOUL.md if the agent is off-brand or off-scope
4. Reset session if you make significant SOUL.md changes
5. Iterate on heartbeat frequency based on task volume
