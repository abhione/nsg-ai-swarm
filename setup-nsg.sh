#!/bin/bash
# Setup NSG AI Operations company in Paperclip
# Seeds company, 12 agents (3 departments), 5 goals, and 16 issues
set -e

API="http://localhost:3100/api"

echo "=== Creating Company ==="
COMPANY=$(curl -s -X POST "$API/companies" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "NSG AI Operations",
    "description": "AI-powered marketing automation for 1,000+ vision care practices. Autonomous agents handle client intelligence, campaign operations, analytics, and meeting prep across ophthalmology, optometry, and optical.",
    "budgetMonthlyCents": 50000
  }')
COMPANY_ID=$(echo "$COMPANY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Company ID: $COMPANY_ID"

echo ""
echo "=== Creating Agents ==="

# ──────────────────────────────────────────────
# TOP LEVEL
# ──────────────────────────────────────────────

# 1. Atlas — Chief AI Officer (CEO)
ATLAS=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Atlas",
    "role": "ceo",
    "title": "Chief AI Officer",
    "icon": "crown",
    "capabilities": "Executive orchestrator. Breaks company goal into departmental objectives. Reviews cross-department dependencies. Escalates governance decisions to the Board.",
    "adapterType": "process",
    "budgetMonthlyCents": 5000,
    "runtimeConfig": {"heartbeat": {"enabled": true, "intervalSec": 14400}}
  }')
ATLAS_ID=$(echo "$ATLAS" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Atlas (CEO): $ATLAS_ID"

# ──────────────────────────────────────────────
# CLIENT INTELLIGENCE DEPT (reports to Atlas)
# ──────────────────────────────────────────────

# 2. Athena — VP Client Intelligence
ATHENA=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Athena\",
    \"role\": \"cmo\",
    \"title\": \"VP Client Intelligence\",
    \"icon\": \"brain\",
    \"reportsTo\": \"$ATLAS_ID\",
    \"capabilities\": \"Owns the client intelligence platform. Manages agents that auto-populate and maintain practice profiles from websites, call transcripts, emails, and EHR data. Ensures every strategist has instant access to comprehensive client context for all 1,000 practices.\",
    \"adapterType\": \"process\",
    \"budgetMonthlyCents\": 5000,
    \"runtimeConfig\": {\"heartbeat\": {\"enabled\": true, \"intervalSec\": 7200}}
  }")
ATHENA_ID=$(echo "$ATHENA" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Athena (VP Client Intelligence): $ATHENA_ID"

# 3. Scout — Client Profiler
SCOUT=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Scout\",
    \"role\": \"researcher\",
    \"title\": \"Client Profiler\",
    \"icon\": \"search\",
    \"reportsTo\": \"$ATHENA_ID\",
    \"capabilities\": \"Scrapes practice websites, social media, and public data to build client profiles. Extracts: services, staff bios, specialties, locations, branding, competitive positioning. Outputs structured JSON profiles for the intelligence brain.\",
    \"adapterType\": \"process\",
    \"budgetMonthlyCents\": 4000,
    \"runtimeConfig\": {\"heartbeat\": {\"enabled\": true, \"intervalSec\": 7200}}
  }")
SCOUT_ID=$(echo "$SCOUT" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Scout (Client Profiler): $SCOUT_ID"

# 4. Echo — Transcript Analyst
ECHO_AGENT=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Echo\",
    \"role\": \"researcher\",
    \"title\": \"Transcript Analyst\",
    \"icon\": \"eye\",
    \"reportsTo\": \"$ATHENA_ID\",
    \"capabilities\": \"Processes call transcripts from client meetings. Extracts pain points, goals, action items, sentiment shifts, service requests. Updates client profiles after every call. Generates pre-call briefs for strategists.\",
    \"adapterType\": \"process\",
    \"budgetMonthlyCents\": 4000,
    \"runtimeConfig\": {\"heartbeat\": {\"enabled\": true, \"intervalSec\": 7200}}
  }")
ECHO_ID=$(echo "$ECHO_AGENT" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Echo (Transcript Analyst): $ECHO_ID"

# ──────────────────────────────────────────────
# CAMPAIGN OPERATIONS DEPT (reports to Atlas)
# ──────────────────────────────────────────────

# 5. Apollo — VP Campaign Operations
APOLLO=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Apollo\",
    \"role\": \"cmo\",
    \"title\": \"VP Campaign Operations\",
    \"icon\": \"rocket\",
    \"reportsTo\": \"$ATLAS_ID\",
    \"capabilities\": \"Owns multi-channel campaign pipeline from strategy to deployment. Manages campaign planning, content generation, and Patient Engage deployment. Produces quarterly campaign calendars for all practices: emails, texts, social, GBP, landing pages.\",
    \"adapterType\": \"process\",
    \"budgetMonthlyCents\": 5000,
    \"runtimeConfig\": {\"heartbeat\": {\"enabled\": true, \"intervalSec\": 7200}}
  }")
APOLLO_ID=$(echo "$APOLLO" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Apollo (VP Campaign Operations): $APOLLO_ID"

# 6. Muse — Campaign Strategist
MUSE=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Muse\",
    \"role\": \"pm\",
    \"title\": \"Campaign Strategist\",
    \"icon\": \"sparkles\",
    \"reportsTo\": \"$APOLLO_ID\",
    \"capabilities\": \"Generates quarterly campaign plans from client intelligence. Analyzes historical EPRS scores, seasonality, client goals, competitive landscape. Outputs campaign calendars with up to 9 recommendations, planning presentations, and content briefs per channel.\",
    \"adapterType\": \"process\",
    \"budgetMonthlyCents\": 4000,
    \"runtimeConfig\": {\"heartbeat\": {\"enabled\": true, \"intervalSec\": 7200}}
  }")
MUSE_ID=$(echo "$MUSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Muse (Campaign Strategist): $MUSE_ID"

# 7. Quill — Content Generator
QUILL=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Quill\",
    \"role\": \"designer\",
    \"title\": \"Content Generator\",
    \"icon\": \"globe\",
    \"reportsTo\": \"$APOLLO_ID\",
    \"capabilities\": \"Creates multi-channel marketing content: emails, social posts, GBP posts, SMS, landing page copy. Uses client intelligence for personalization, campaign strategy for messaging, brand guidelines for tone. Outputs Patient Engage-ready format.\",
    \"adapterType\": \"process\",
    \"budgetMonthlyCents\": 4000,
    \"runtimeConfig\": {\"heartbeat\": {\"enabled\": true, \"intervalSec\": 7200}}
  }")
QUILL_ID=$(echo "$QUILL" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Quill (Content Generator): $QUILL_ID"

# ──────────────────────────────────────────────
# ANALYTICS & REPORTING DEPT (reports to Atlas)
# ──────────────────────────────────────────────

# 8. Oracle — VP Analytics & Reporting
ORACLE=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Oracle\",
    \"role\": \"cto\",
    \"title\": \"VP Analytics & Reporting\",
    \"icon\": \"target\",
    \"reportsTo\": \"$ATLAS_ID\",
    \"capabilities\": \"Owns all reporting and analytics. Manages data aggregation from 10-15 marketing platforms, performance reports with NSG proprietary methodology, and anomaly monitoring with AI-powered alerting.\",
    \"adapterType\": \"process\",
    \"budgetMonthlyCents\": 5000,
    \"runtimeConfig\": {\"heartbeat\": {\"enabled\": true, \"intervalSec\": 7200}}
  }")
ORACLE_ID=$(echo "$ORACLE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Oracle (VP Analytics & Reporting): $ORACLE_ID"

# 9. Flux — Data Aggregator
FLUX=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Flux\",
    \"role\": \"devops\",
    \"title\": \"Data Aggregator\",
    \"icon\": \"shield\",
    \"reportsTo\": \"$ORACLE_ID\",
    \"capabilities\": \"Pulls and normalizes data from Google Analytics, SEMrush, BrightLocal, Facebook Ads, Google Search Console, Patient Engage metrics, and EHR data. Outputs unified datasets. Runs daily pulls, weekly consolidation.\",
    \"adapterType\": \"process\",
    \"budgetMonthlyCents\": 4000,
    \"runtimeConfig\": {\"heartbeat\": {\"enabled\": true, \"intervalSec\": 3600}}
  }")
FLUX_ID=$(echo "$FLUX" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Flux (Data Aggregator): $FLUX_ID"

# 10. Sentinel — Alert Monitor
SENTINEL=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Sentinel\",
    \"role\": \"qa\",
    \"title\": \"Alert Monitor\",
    \"icon\": \"eye\",
    \"reportsTo\": \"$ORACLE_ID\",
    \"capabilities\": \"Monitors marketing performance across all practices. Detects anomalies: keyword ranking drops 3+ months, email open rate decline, traffic drops, conversion changes. Generates contextual alerts with root cause analysis and recommended actions.\",
    \"adapterType\": \"process\",
    \"budgetMonthlyCents\": 3000,
    \"runtimeConfig\": {\"heartbeat\": {\"enabled\": true, \"intervalSec\": 3600}}
  }")
SENTINEL_ID=$(echo "$SENTINEL" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Sentinel (Alert Monitor): $SENTINEL_ID"

# 11. Compass — SEO Auditor
COMPASS=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Compass\",
    \"role\": \"researcher\",
    \"title\": \"SEO Auditor\",
    \"icon\": \"search\",
    \"reportsTo\": \"$ORACLE_ID\",
    \"capabilities\": \"Performs automated SEO audits across all 1,000 practices. Covers 15 SEO items: on-site, rankings, GA, GSC, BrightLocal, citations, backlinks, competitive positioning. Outputs audit reports with prioritized fix recommendations.\",
    \"adapterType\": \"process\",
    \"budgetMonthlyCents\": 3000,
    \"runtimeConfig\": {\"heartbeat\": {\"enabled\": true, \"intervalSec\": 7200}}
  }")
COMPASS_ID=$(echo "$COMPASS" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Compass (SEO Auditor): $COMPASS_ID"

# ──────────────────────────────────────────────
# CROSS-FUNCTIONAL (reports to Atlas directly)
# ──────────────────────────────────────────────

# 12. Relay — Meeting Assistant
RELAY=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Relay\",
    \"role\": \"general\",
    \"title\": \"Meeting Assistant\",
    \"icon\": \"mail\",
    \"reportsTo\": \"$ATLAS_ID\",
    \"capabilities\": \"Pre-call: generates agenda, pulls performance data, summarizes client profile, prepares talking points. Post-call: processes transcript, extracts action items, creates tasks, drafts follow-up email, updates client intelligence profile.\",
    \"adapterType\": \"process\",
    \"budgetMonthlyCents\": 3000,
    \"runtimeConfig\": {\"heartbeat\": {\"enabled\": true, \"intervalSec\": 7200}}
  }")
RELAY_ID=$(echo "$RELAY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Relay (Meeting Assistant): $RELAY_ID"

echo ""
echo "=== Creating Goals ==="

# Company-level goal owned by Atlas
GOAL_MAIN=$(curl -s -X POST "$API/companies/$COMPANY_ID/goals" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Automate Q2 campaign cycle for pilot practices\",
    \"description\": \"Primary company objective: execute a fully automated Q2 2026 campaign cycle for 3 pilot vision care practices, demonstrating end-to-end AI-driven marketing automation from intelligence gathering through deployment and reporting.\",
    \"level\": \"company\",
    \"status\": \"active\",
    \"ownerAgentId\": \"$ATLAS_ID\"
  }")
GOAL_MAIN_ID=$(echo "$GOAL_MAIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Main Goal: $GOAL_MAIN_ID"

# Sub-goal: Client intelligence profiles (Athena)
GOAL_INTEL=$(curl -s -X POST "$API/companies/$COMPANY_ID/goals" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Build comprehensive intelligence profiles for 3 pilot practices\",
    \"description\": \"Create detailed client intelligence profiles for Levin Eye Care, Starwood Vision, and Pacific Eye Associates. Profiles must include services, staff, locations, branding, competitive positioning, call transcript insights, and historical performance data.\",
    \"level\": \"team\",
    \"status\": \"active\",
    \"parentId\": \"$GOAL_MAIN_ID\",
    \"ownerAgentId\": \"$ATHENA_ID\"
  }")
GOAL_INTEL_ID=$(echo "$GOAL_INTEL" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Intel Goal: $GOAL_INTEL_ID"

# Sub-goal: Campaign generation and deployment (Apollo)
GOAL_CAMPAIGN=$(curl -s -X POST "$API/companies/$COMPANY_ID/goals" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Generate and deploy Q2 campaigns for 3 pilot practices\",
    \"description\": \"Produce complete Q2 2026 campaign plans and content for all 3 pilot practices. Includes email cadences, GBP posts, social media content, SMS, and landing pages deployed through Patient Engage.\",
    \"level\": \"team\",
    \"status\": \"active\",
    \"parentId\": \"$GOAL_MAIN_ID\",
    \"ownerAgentId\": \"$APOLLO_ID\"
  }")
GOAL_CAMPAIGN_ID=$(echo "$GOAL_CAMPAIGN" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Campaign Goal: $GOAL_CAMPAIGN_ID"

# Sub-goal: Baseline metrics and monitoring (Oracle)
GOAL_ANALYTICS=$(curl -s -X POST "$API/companies/$COMPANY_ID/goals" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Establish baseline metrics and monitoring for pilot practices\",
    \"description\": \"Aggregate 6 months of historical data, establish performance baselines, configure automated monitoring and alerting, and complete SEO audits for all 3 pilot practices.\",
    \"level\": \"team\",
    \"status\": \"active\",
    \"parentId\": \"$GOAL_MAIN_ID\",
    \"ownerAgentId\": \"$ORACLE_ID\"
  }")
GOAL_ANALYTICS_ID=$(echo "$GOAL_ANALYTICS" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Analytics Goal: $GOAL_ANALYTICS_ID"

# Sub-goal: Meeting prep time savings (Relay)
GOAL_MEETINGS=$(curl -s -X POST "$API/companies/$COMPANY_ID/goals" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Demonstrate 30% time savings on meeting prep and follow-up\",
    \"description\": \"Automate pre-call brief generation, post-call transcript processing, action item extraction, and follow-up drafting. Measure and demonstrate at least 30% time savings compared to manual process.\",
    \"level\": \"team\",
    \"status\": \"active\",
    \"parentId\": \"$GOAL_MAIN_ID\",
    \"ownerAgentId\": \"$RELAY_ID\"
  }")
GOAL_MEETINGS_ID=$(echo "$GOAL_MEETINGS" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Meetings Goal: $GOAL_MEETINGS_ID"

echo ""
echo "=== Creating Issues ==="

# Issue 1: Q2 2026 Campaign Cycle — Pilot (critical, Atlas)
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Q2 2026 Campaign Cycle — Pilot (3 Practices)\",
    \"description\": \"Execute full Q2 campaign cycle for 3 pilot practices: Levin Eye Care (Cleveland), Starwood Vision (Tampa), Pacific Eye Associates (San Francisco). Demonstrate end-to-end automation: intelligence gathering, campaign planning, content generation, deployment, and reporting.\",
    \"status\": \"backlog\",
    \"priority\": \"critical\",
    \"assigneeAgentId\": \"$ATLAS_ID\",
    \"goalId\": \"$GOAL_MAIN_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Issue 1 (Q2 Pilot): {d[\"id\"]}')"

# Issue 2: Build Client Intelligence Profiles (high, Athena)
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Build Client Intelligence Profiles — 3 Pilot Practices\",
    \"description\": \"Build comprehensive client intelligence profiles for Levin Eye Care, Starwood Vision, and Pacific Eye Associates. Aggregate data from website scraping, call transcripts, and public sources into structured profiles.\",
    \"status\": \"backlog\",
    \"priority\": \"high\",
    \"assigneeAgentId\": \"$ATHENA_ID\",
    \"goalId\": \"$GOAL_INTEL_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Issue 2 (Intel Profiles): {d[\"id\"]}')"

# Issue 3: Scrape & Profile: Levin Eye Care (high, Scout)
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Scrape & Profile: Levin Eye Care (Cleveland, OH)\",
    \"description\": \"Website levineyecare.com. Scrape full site, extract services (LASIK, cataract, comprehensive eye exams, pediatric), staff bios (Dr. Mark Levin, Dr. Sarah Chen), locations (2 offices), branding elements, insurance panels. Output structured JSON profile.\",
    \"status\": \"backlog\",
    \"priority\": \"high\",
    \"assigneeAgentId\": \"$SCOUT_ID\",
    \"goalId\": \"$GOAL_INTEL_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Issue 3 (Scrape Levin): {d[\"id\"]}')"

# Issue 4: Scrape & Profile: Starwood Vision (high, Scout)
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Scrape & Profile: Starwood Vision (Tampa, FL)\",
    \"description\": \"Website starwoodvision.com. Scrape for services (glaucoma, retina, contacts, dry eye therapy), staff (Dr. James Patel, Dr. Nicole Rivera), locations (3 offices in Tampa Bay), insurance panels. Output structured JSON profile.\",
    \"status\": \"backlog\",
    \"priority\": \"high\",
    \"assigneeAgentId\": \"$SCOUT_ID\",
    \"goalId\": \"$GOAL_INTEL_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Issue 4 (Scrape Starwood): {d[\"id\"]}')"

# Issue 5: Scrape & Profile: Pacific Eye Associates (high, Scout)
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Scrape & Profile: Pacific Eye Associates (San Francisco, CA)\",
    \"description\": \"Website pacificeyesf.com. Scrape for services (LASIK, premium IOLs, myopia management, cosmetic), staff (Dr. Amy Zhao, Dr. David Kim), location (1 flagship office). Output structured JSON profile.\",
    \"status\": \"backlog\",
    \"priority\": \"high\",
    \"assigneeAgentId\": \"$SCOUT_ID\",
    \"goalId\": \"$GOAL_INTEL_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Issue 5 (Scrape Pacific): {d[\"id\"]}')"

# Issue 6: Process Call Transcripts — Levin Eye Care (high, Echo)
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Process Call Transcripts — Levin Eye Care (3 recent calls)\",
    \"description\": \"Analyze 3 recent call transcripts. Extract pain points (patient no-shows, insurance verification delays), Q2 goals (increase LASIK consultations 20%), action items, sentiment shifts. Update client intelligence profile.\",
    \"status\": \"backlog\",
    \"priority\": \"high\",
    \"assigneeAgentId\": \"$ECHO_ID\",
    \"goalId\": \"$GOAL_INTEL_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Issue 6 (Transcripts Levin): {d[\"id\"]}')"

# Issue 7: Generate Pre-Call Brief: Levin Eye Care Q2 Planning (high, Relay)
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Generate Pre-Call Brief: Levin Eye Care Q2 Planning\",
    \"description\": \"Generate comprehensive pre-call brief for Levin Eye Care Q2 planning call. Include: agenda, performance summary, client profile highlights, talking points, open action items from previous calls, and recommended discussion topics.\",
    \"status\": \"backlog\",
    \"priority\": \"high\",
    \"assigneeAgentId\": \"$RELAY_ID\",
    \"goalId\": \"$GOAL_MEETINGS_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Issue 7 (Pre-Call Brief): {d[\"id\"]}')"

# Issue 8: Generate Q2 Campaign Plans — 3 Practices (high, Muse)
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Generate Q2 Campaign Plans — 3 Practices\",
    \"description\": \"Create comprehensive Q2 2026 campaign plans for all 3 pilot practices based on client intelligence profiles. Each plan should include campaign calendar, channel strategy, content briefs, and KPI targets.\",
    \"status\": \"backlog\",
    \"priority\": \"high\",
    \"assigneeAgentId\": \"$MUSE_ID\",
    \"goalId\": \"$GOAL_CAMPAIGN_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Issue 8 (Q2 Plans All): {d[\"id\"]}')"

# Issue 9: Q2 Campaign Plan: Levin Eye Care (high, Muse)
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Q2 Campaign Plan: Levin Eye Care\",
    \"description\": \"Q2 plan focused on LASIK spring campaign, back-to-school pediatric push, dry eye awareness month. Include email cadence (2x/month), GBP posts (weekly), social (3x/week), 1 SMS per month. Output campaign calendar and content briefs.\",
    \"status\": \"backlog\",
    \"priority\": \"high\",
    \"assigneeAgentId\": \"$MUSE_ID\",
    \"goalId\": \"$GOAL_CAMPAIGN_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Issue 9 (Plan Levin): {d[\"id\"]}')"

# Issue 10: Q2 Campaign Plan: Starwood Vision (high, Muse)
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Q2 Campaign Plan: Starwood Vision\",
    \"description\": \"Q2 plan focused on glaucoma awareness, new dry eye therapy launch, Tampa Bay sports vision partnership. Include email cadence (2x/month), GBP posts (weekly), social (4x/week), SMS for new patients. Output campaign calendar and content briefs.\",
    \"status\": \"backlog\",
    \"priority\": \"high\",
    \"assigneeAgentId\": \"$MUSE_ID\",
    \"goalId\": \"$GOAL_CAMPAIGN_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Issue 10 (Plan Starwood): {d[\"id\"]}')"

# Issue 11: Generate Campaign Content — Levin Eye Care Q2 (medium, Quill)
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Generate Campaign Content — Levin Eye Care Q2\",
    \"description\": \"Create all content: 6 email campaigns, 12 GBP posts, 36 social posts (FB/IG/LinkedIn), 3 SMS messages, 1 landing page for LASIK spring promo. All content must align with campaign plan and use client intelligence for personalization.\",
    \"status\": \"backlog\",
    \"priority\": \"medium\",
    \"assigneeAgentId\": \"$QUILL_ID\",
    \"goalId\": \"$GOAL_CAMPAIGN_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Issue 11 (Content Levin): {d[\"id\"]}')"

# Issue 12: Generate Campaign Content — Starwood Vision Q2 (medium, Quill)
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Generate Campaign Content — Starwood Vision Q2\",
    \"description\": \"Create all content: 6 email campaigns, 12 GBP posts, 48 social posts, 4 SMS messages, 2 landing pages (dry eye therapy + new patient). All content must align with campaign plan and use client intelligence for personalization.\",
    \"status\": \"backlog\",
    \"priority\": \"medium\",
    \"assigneeAgentId\": \"$QUILL_ID\",
    \"goalId\": \"$GOAL_CAMPAIGN_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Issue 12 (Content Starwood): {d[\"id\"]}')"

# Issue 13: Aggregate Baseline Data — All 3 Practices (high, Flux)
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Aggregate Baseline Data — All 3 Practices\",
    \"description\": \"Pull 6 months of historical data from all platforms. Normalize into unified format. Calculate baseline metrics: keyword rankings, organic traffic, email open rates, conversion rates. Output unified dataset for each practice.\",
    \"status\": \"backlog\",
    \"priority\": \"high\",
    \"assigneeAgentId\": \"$FLUX_ID\",
    \"goalId\": \"$GOAL_ANALYTICS_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Issue 13 (Baseline Data): {d[\"id\"]}')"

# Issue 14: Set Up Performance Monitoring — 3 Pilot Practices (high, Flux)
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Set Up Performance Monitoring — 3 Pilot Practices\",
    \"description\": \"Configure data aggregation pipeline. Pull from SEMrush, BrightLocal, Google Analytics, Patient Engage. Establish baselines and alert thresholds for all 3 pilot practices.\",
    \"status\": \"backlog\",
    \"priority\": \"high\",
    \"assigneeAgentId\": \"$FLUX_ID\",
    \"goalId\": \"$GOAL_ANALYTICS_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Issue 14 (Monitoring Setup): {d[\"id\"]}')"

# Issue 15: SEO Audit: Levin Eye Care (medium, Compass)
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"SEO Audit: Levin Eye Care\",
    \"description\": \"Full 15-point SEO audit for levineyecare.com: technical SEO, on-page optimization, local SEO (GMB, citations, reviews), keyword rankings, backlink profile, Core Web Vitals, mobile optimization. Output prioritized fix recommendations.\",
    \"status\": \"backlog\",
    \"priority\": \"medium\",
    \"assigneeAgentId\": \"$COMPASS_ID\",
    \"goalId\": \"$GOAL_ANALYTICS_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Issue 15 (SEO Audit Levin): {d[\"id\"]}')"

# Issue 16: Configure Alert Rules — Pilot Practices (medium, Sentinel)
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Configure Alert Rules — Pilot Practices\",
    \"description\": \"Set up monitoring rules: keyword drop > 5 positions for 2+ months, email open rate drop > 15% month-over-month, organic traffic decline > 20%, conversion rate anomaly detection. Configure for all 3 pilot practices.\",
    \"status\": \"backlog\",
    \"priority\": \"medium\",
    \"assigneeAgentId\": \"$SENTINEL_ID\",
    \"goalId\": \"$GOAL_ANALYTICS_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Issue 16 (Alert Rules): {d[\"id\"]}')"

echo ""
echo "=== Setup Complete ==="
echo "Company: NSG AI Operations ($COMPANY_ID)"
echo "Agents: 12 created"
echo "  - Atlas (CEO)"
echo "  - Client Intelligence: Athena, Scout, Echo"
echo "  - Campaign Operations: Apollo, Muse, Quill"
echo "  - Analytics & Reporting: Oracle, Flux, Sentinel, Compass"
echo "  - Cross-Functional: Relay"
echo "Goals: 5 created (1 company + 4 sub-goals)"
echo "Issues: 16 created and assigned"
echo ""
echo "Dashboard: http://localhost:3100"
