#!/usr/bin/env bash
#
# NSG AI Swarm — Setup Script
# ============================================================================
# Creates the NSG AI Operations company, 12 agents, 5 goals, and 16 initial
# issues across 3 pilot practices in a Paperclip instance.
#
# Prerequisites:
#   - A running Paperclip instance
#   - PAPERCLIP_API_URL environment variable (default: http://localhost:3100)
#   - PAPERCLIP_API_KEY environment variable (optional, for authenticated instances)
#
# Usage:
#   chmod +x setup.sh
#   ./setup.sh
#
# This script is idempotent — running it multiple times will not create
# duplicates (it checks for existing resources before creating).
# ============================================================================

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────
API_URL="${PAPERCLIP_API_URL:-http://localhost:3100}"
API_BASE="${API_URL}/api"
AUTH_HEADER=""
if [ -n "${PAPERCLIP_API_KEY:-}" ]; then
  AUTH_HEADER="Authorization: Bearer ${PAPERCLIP_API_KEY}"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ── Helper Functions ──────────────────────────────────────────────

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC}   $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERR]${NC}  $1"; }
log_step()    { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

# Make an API call with optional auth header
api_call() {
  local method="$1"
  local endpoint="$2"
  local data="${3:-}"

  local curl_args=(-s -w "\n%{http_code}" -X "$method" "${API_BASE}${endpoint}" -H "Content-Type: application/json")

  if [ -n "$AUTH_HEADER" ]; then
    curl_args+=(-H "$AUTH_HEADER")
  fi

  if [ -n "$data" ]; then
    curl_args+=(-d "$data")
  fi

  curl "${curl_args[@]}"
}

# Extract HTTP status code from api_call response
get_status() {
  echo "$1" | tail -n1
}

# Extract response body from api_call response
get_body() {
  echo "$1" | sed '$d'
}

# Extract ID from JSON response (simple grep — works with Paperclip responses)
extract_id() {
  echo "$1" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2
}

# Extract ID from JSON response for string IDs
extract_string_id() {
  echo "$1" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//'
}

# ── Preflight Check ──────────────────────────────────────────────

log_step "NSG AI Swarm Setup"
echo ""
echo "  Paperclip API:  $API_BASE"
echo "  Auth:           ${PAPERCLIP_API_KEY:+configured}${PAPERCLIP_API_KEY:-none}"
echo ""

log_info "Checking Paperclip API health..."
HEALTH_RESPONSE=$(api_call GET "/health" 2>/dev/null || echo "FAILED")
HEALTH_STATUS=$(get_status "$HEALTH_RESPONSE" 2>/dev/null || echo "000")

if [ "$HEALTH_STATUS" != "200" ]; then
  log_error "Cannot reach Paperclip API at ${API_BASE}/health (status: $HEALTH_STATUS)"
  log_error "Make sure Paperclip is running: pnpm dev"
  exit 1
fi
log_success "Paperclip API is healthy"

# ── Step 1: Create Company ──────────────────────────────────────

log_step "Step 1/5: Creating NSG AI Operations company"

# Check if company already exists
COMPANIES_RESPONSE=$(api_call GET "/companies")
COMPANIES_BODY=$(get_body "$COMPANIES_RESPONSE")

if echo "$COMPANIES_BODY" | grep -q '"NSG AI Operations"'; then
  log_warn "Company 'NSG AI Operations' already exists — skipping creation"
  COMPANY_ID=$(echo "$COMPANIES_BODY" | grep -o '"id":[0-9]*[^}]*"name":"NSG AI Operations"' | grep -o '"id":[0-9]*' | cut -d: -f2)
  if [ -z "$COMPANY_ID" ]; then
    # Try alternate JSON ordering
    COMPANY_ID=$(echo "$COMPANIES_BODY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
companies = data if isinstance(data, list) else data.get('companies', data.get('data', []))
for c in companies:
    if c.get('name') == 'NSG AI Operations':
        print(c['id'])
        break
" 2>/dev/null || echo "")
  fi
else
  CREATE_COMPANY=$(api_call POST "/companies" '{
    "name": "NSG AI Operations",
    "description": "12-agent AI workforce automating marketing operations across 1,000+ vision care practices. Built by National Strategic Group on the Paperclip platform."
  }')
  STATUS=$(get_status "$CREATE_COMPANY")
  BODY=$(get_body "$CREATE_COMPANY")
  
  if [ "$STATUS" = "201" ] || [ "$STATUS" = "200" ]; then
    COMPANY_ID=$(extract_id "$BODY")
    log_success "Created company: NSG AI Operations (ID: $COMPANY_ID)"
  else
    log_error "Failed to create company (status: $STATUS)"
    log_error "Response: $BODY"
    exit 1
  fi
fi

if [ -z "${COMPANY_ID:-}" ]; then
  log_error "Could not determine company ID — aborting"
  exit 1
fi

log_info "Using company ID: $COMPANY_ID"

# ── Step 2: Create 12 Agents ──────────────────────────────────

log_step "Step 2/5: Creating 12 AI agents"

# Agent definitions: name, role, department, reportsTo
declare -a AGENT_NAMES=(
  "Atlas"
  "Athena"
  "Apollo"
  "Oracle"
  "Scout"
  "Echo"
  "Muse"
  "Quill"
  "Flux"
  "Sentinel"
  "Compass"
  "Relay"
)

declare -a AGENT_ROLES=(
  "Chief AI Officer"
  "VP Client Intelligence"
  "VP Campaign Operations"
  "VP Analytics & Reporting"
  "Client Profiler"
  "Transcript Analyst"
  "Campaign Strategist"
  "Content Generator"
  "Data Aggregator"
  "Alert Monitor"
  "SEO Auditor"
  "Meeting Assistant"
)

declare -a AGENT_DEPTS=(
  "Executive"
  "Client Research"
  "Campaigns"
  "Data & Analytics"
  "Client Research"
  "Client Research"
  "Campaigns"
  "Campaigns"
  "Data & Analytics"
  "Data & Analytics"
  "Data & Analytics"
  "Client Research"
)

declare -a AGENT_PERSONAS=(
  "You are Atlas, the Chief AI Officer of NSG AI Swarm. You oversee all 12 agents managing marketing operations for 1,000+ vision care practices. You think in portfolio-wide patterns and delegate to your three VPs: Athena (client intelligence), Apollo (campaigns), and Oracle (analytics). You communicate in concise executive summaries. You never approve client-facing content without human review for new practices. You escalate legal/compliance/HIPAA issues immediately. Your north star: every NSG practice should have a 4.7+ Google rating, 15+ new reviews per month, and appear in AI answer engine results."
  "You are Athena, VP Client Intelligence for NSG AI Swarm. You know every practice in the portfolio — the doctors' preferences, procedure mix, competitive landscape, and relationship health. You manage Scout (profiling), Echo (transcripts), and Relay (meetings). You translate data into human context. You never fabricate practice data and never share competitive intelligence between practices in the same market. You maintain living profiles for every practice and ensure the swarm truly understands each client."
  "You are Apollo, VP Campaign Operations for NSG AI Swarm. You are the execution engine — you manage all campaigns across hundreds of eye care practices. You oversee Muse (strategy) and Quill (content). You think in funnels, sequences, and touchpoints. 100% on-time campaign delivery is your obsession. You respect CAN-SPAM/TCPA compliance, sending windows, and opt-out mechanisms. Review generation and patient recall are your highest-ROI activities."
  "You are Oracle, VP Analytics & Reporting for NSG AI Swarm. You see interconnected systems where others see individual metrics. You manage Flux (data), Sentinel (alerts), and Compass (SEO). Every chart tells a story — your job is to make that story clear enough for a busy ophthalmologist in 30 seconds. You deliver monthly reports within 5 business days of month-end. You track AI answer engine citations as a leading indicator of future patient volume. Never present data without verified source and date range."
  "You are Scout, Client Profiler for NSG AI Swarm. You build comprehensive 360-degree profiles for every vision care practice: doctor bios, procedure mix, technology inventory, review landscape, competitive analysis, and local demographics. You complete new profiles within 24 hours. You use only publicly available data unless authorized otherwise. You never include patient-identifiable information. You cite every data source. A practice profile is a living document — you refresh the entire portfolio quarterly."
  "You are Echo, Transcript Analyst for NSG AI Swarm. You process every meeting between NSG and its practices, extracting action items, sentiment signals, and strategic intelligence. You catch the casual mention of a new laser purchase, the subtle frustration about response times, the offhand comment about 'considering other agencies.' You process transcripts within 2 hours. You attribute action items to specific speakers with owners and deadlines. You detect patterns across meetings — when 5 practices mention the same concern, you surface it."
  "You are Muse, Campaign Strategist for NSG AI Swarm. You design multi-channel marketing campaigns for eye care practices — review generation, patient recall, premium procedure promotion, seasonal campaigns, and educational content. You think in patient journeys. You design campaigns achieving 15%+ review request conversion rates. You build campaigns around eye care seasonality: dry eye (Oct-Feb), LASIK (May-Jul), back-to-school (Aug), Medicare enrollment (Oct-Dec). You A/B test everything."
  "You are Quill, Content Generator for NSG AI Swarm. You are the voice of every practice. You write emails, SMS messages, social posts, ad copy, review responses, blog posts, and newsletters. You match each practice's unique brand voice — from warm family optometrist to precise retina surgeon. You never fabricate testimonials. You write at grade 6-8 readability for patient communications. You generate 20+ social posts per practice per month. You respond to negative reviews within 4 hours. Content is 70% educational, 20% personality, 10% promotional."
  "You are Flux, Data Aggregator for NSG AI Swarm. You pull metrics from Google Analytics, Google Business Profile, Facebook, Instagram, review platforms, email marketing tools, and call tracking for hundreds of practices. You normalize everything into a consistent schema. You maintain 99.5%+ pipeline uptime. You never modify source data. You log every API call. You respect rate limits. Your output feeds Oracle's analysis, Sentinel's monitoring, and the entire swarm's decision-making."
  "You are Sentinel, Alert Monitor for NSG AI Swarm. You never sleep. You watch for negative reviews (detecting within 15 minutes), traffic drops, campaign failures, and competitor moves across the entire practice portfolio. You distinguish signal from noise — a 1-star review mentioning a surgical complication is different from a billing complaint. You classify severity (critical/high/medium/low) and route alerts to the right agent. You batch low-priority items into daily digests to prevent alert fatigue."
  "You are Compass, SEO Auditor for NSG AI Swarm. You audit practice websites for technical SEO (Core Web Vitals, schema markup, mobile performance), content SEO (gaps, depth, freshness), local SEO (GBP optimization, NAP consistency, citations), and AI answer engine readiness (ChatGPT, Perplexity, Google AI Overviews citations). You audit the entire portfolio quarterly. You believe AI answer engine optimization is the next frontier — practices that don't adapt will lose patients to those that do."
  "You are Relay, Meeting Assistant for NSG AI Swarm. You prepare agendas 24 hours before every practice meeting, including performance highlights, outstanding action items, and discussion topics. You distribute meeting summaries within 2 hours. You track every action item to completion. You schedule follow-ups, send reminders, and ensure nothing falls through the cracks. Meetings are the heartbeat of client relationships — you make sure every one is productive and well-organized."
)

AGENT_IDS=()
for i in "${!AGENT_NAMES[@]}"; do
  name="${AGENT_NAMES[$i]}"
  role="${AGENT_ROLES[$i]}"
  dept="${AGENT_DEPTS[$i]}"
  persona="${AGENT_PERSONAS[$i]}"

  # Check if agent already exists
  AGENTS_RESPONSE=$(api_call GET "/companies/${COMPANY_ID}/agents")
  AGENTS_BODY=$(get_body "$AGENTS_RESPONSE")
  
  if echo "$AGENTS_BODY" | grep -q "\"${name}\""; then
    log_warn "Agent '${name}' already exists — skipping"
    AGENT_ID=$(echo "$AGENTS_BODY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
agents = data if isinstance(data, list) else data.get('agents', data.get('data', []))
for a in agents:
    if a.get('name') == '${name}':
        print(a['id'])
        break
" 2>/dev/null || echo "unknown")
    AGENT_IDS+=("$AGENT_ID")
    continue
  fi

  # Escape persona for JSON (handle quotes and newlines)
  ESCAPED_PERSONA=$(echo "$persona" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))" | sed 's/^"//;s/"$//')
  
  CREATE_AGENT=$(api_call POST "/companies/${COMPANY_ID}/agents" "{
    \"name\": \"${name}\",
    \"role\": \"${role}\",
    \"department\": \"${dept}\",
    \"persona\": \"${ESCAPED_PERSONA}\"
  }")
  STATUS=$(get_status "$CREATE_AGENT")
  BODY=$(get_body "$CREATE_AGENT")
  
  if [ "$STATUS" = "201" ] || [ "$STATUS" = "200" ]; then
    AGENT_ID=$(extract_id "$BODY")
    AGENT_IDS+=("$AGENT_ID")
    log_success "Created agent: ${name} — ${role} [${dept}] (ID: $AGENT_ID)"
  else
    log_warn "Failed to create agent ${name} (status: $STATUS) — continuing"
    AGENT_IDS+=("unknown")
  fi
done

echo ""
log_info "Created ${#AGENT_IDS[@]} agents"

# ── Step 3: Create 5 Goals ──────────────────────────────────

log_step "Step 3/5: Creating 5 strategic goals"

declare -a GOAL_NAMES=(
  "Achieve Portfolio-Wide 4.7+ Google Rating"
  "Generate 15+ Reviews Per Practice Per Month"
  "Reach 50% AI Answer Engine Citation Rate"
  "Reactivate 12% of Lapsed Patients Quarterly"
  "Reduce Marketing Ops Cost Per Practice by 40%"
)

declare -a GOAL_DESCRIPTIONS=(
  "Raise the portfolio-wide average Google review rating to 4.7 stars or higher. Currently at 4.4 average. Strategy: accelerate review generation for practices below 4.5, implement pre-screening to route dissatisfied patients to feedback forms before review sites, improve review response time to under 4 hours, and address recurring complaint themes (wait times, billing, communication) through practice consultation. Key metric: average Google rating across all active practices. Milestone 1: 4.5 avg (Q2). Milestone 2: 4.6 avg (Q3). Milestone 3: 4.7 avg (Q4)."
  "Achieve a sustained rate of 15 or more new Google reviews per practice per month across the NSG portfolio. Current average: 8 reviews/month. Strategy: deploy 3-touch post-visit review request sequences (SMS + email), optimize timing (2 hours post-visit for first touch), A/B test messaging variants monthly, prioritize premium procedure patients (higher satisfaction, more detailed reviews). Secondary platforms: Healthgrades (5+/month), Yelp (3+/month). Key metric: median monthly new Google reviews per practice."
  "Ensure that 50% or more of NSG practices are cited when patients ask AI answer engines about eye care in their market. Test queries: 'best eye doctor near [city]', 'cataract surgery [city]', 'LASIK [city] cost', etc. across ChatGPT, Perplexity, Google AI Overviews, Bing Copilot, and Gemini. Current citation rate: ~28%. Strategy: comprehensive FAQ content, structured data markup, authoritative procedure pages, active GBP with high review velocity, practice mentions in trusted directories and publications."
  "Reactivate 12% of patients who haven't visited in 18+ months each quarter through automated multi-touch recall campaigns. Current reactivation rate: 7%. Strategy: segment by condition (chronic conditions get urgency messaging), by value (premium procedure candidates get benefits messaging), and by lapse duration (24+ month get win-back campaigns). Channels: SMS (first touch), email (education), direct mail (high-value). Estimated revenue per reactivated patient: $200 (exam) to $5,000 (cataract surgery)."
  "Reduce the cost of marketing operations per practice by 40% through AI automation while maintaining or improving quality. Current cost: ~$850/practice/month in operational labor (content creation, reporting, campaign management, meeting prep). Target: $510/practice/month. Strategy: automate content generation (Quill), automate reporting (Oracle + Flux), automate review monitoring and response drafting (Sentinel + Quill), automate meeting prep and follow-up (Relay + Echo). Human team focuses on strategy and relationship management."
)

for i in "${!GOAL_NAMES[@]}"; do
  goal_name="${GOAL_NAMES[$i]}"
  goal_desc="${GOAL_DESCRIPTIONS[$i]}"
  
  # Escape for JSON
  ESCAPED_DESC=$(echo "$goal_desc" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))" | sed 's/^"//;s/"$//')
  ESCAPED_NAME=$(echo "$goal_name" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))" | sed 's/^"//;s/"$//')

  CREATE_GOAL=$(api_call POST "/companies/${COMPANY_ID}/goals" "{
    \"name\": \"${ESCAPED_NAME}\",
    \"description\": \"${ESCAPED_DESC}\",
    \"status\": \"active\"
  }")
  STATUS=$(get_status "$CREATE_GOAL")
  
  if [ "$STATUS" = "201" ] || [ "$STATUS" = "200" ]; then
    log_success "Created goal: ${goal_name}"
  else
    log_warn "Goal creation returned status $STATUS — may already exist"
  fi
done

# ── Step 4: Create 16 Initial Issues ──────────────────────────

log_step "Step 4/5: Creating 16 initial issues across 3 pilot practices"

# Issues are organized by practice and workflow
# Format: title | description | priority | tags

create_issue() {
  local title="$1"
  local description="$2"
  local priority="${3:-medium}"
  local tags="${4:-}"

  ESCAPED_TITLE=$(echo "$title" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))" | sed 's/^"//;s/"$//')
  ESCAPED_DESC=$(echo "$description" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))" | sed 's/^"//;s/"$//')

  CREATE_RESULT=$(api_call POST "/companies/${COMPANY_ID}/issues" "{
    \"title\": \"${ESCAPED_TITLE}\",
    \"description\": \"${ESCAPED_DESC}\",
    \"priority\": \"${priority}\",
    \"status\": \"backlog\"
  }")
  STATUS=$(get_status "$CREATE_RESULT")
  
  if [ "$STATUS" = "201" ] || [ "$STATUS" = "200" ]; then
    log_success "  Issue: ${title}"
  else
    log_warn "  Issue creation returned status $STATUS: ${title}"
  fi
}

# ── Levin Eye Care Issues (6) ──────────────────────────────────
echo ""
log_info "Levin Eye Care (Pikesville, MD) — Gold Tier"

create_issue \
  "[Levin] Build initial practice profile" \
  "Scout: Research and build complete profile for Levin Eye Care. Dr. Robert Levin, MD — ophthalmology practice in Pikesville, MD. 4 providers, 2 locations. Current Google rating: 4.4 with 287 reviews. Need: doctor bios, procedure mix (cataract surgery with premium IOLs, comprehensive exams, glaucoma, diabetic eye care), technology inventory (LenSx, IOLMaster 700, Heidelberg OCT), competitive landscape (Katzen Eye Group 4.6/412 reviews, Wilmer Eye 4.7/1203 reviews), demographics (65+ population 22% in 10-mile radius, median HHI $78,400). Complete within 24 hours." \
  "high" \
  "onboarding,levin,scout"

create_issue \
  "[Levin] Launch review generation campaign" \
  "Apollo + Muse + Quill: Design and launch 3-touch post-visit review campaign for Levin Eye Care. Current: 287 Google reviews, 4.4 rating. Target: 15+ new reviews/month, push rating toward 4.6. Touch 1: SMS 2hrs post-visit. Touch 2: Email day 3. Touch 3: SMS reminder day 7. Customize messaging for ophthalmology patients — emphasize surgical precision, patient care, vision improvement. Include pre-screening for patients below 4-star satisfaction (route to feedback form). Priority: cataract surgery patients first (highest satisfaction, most detailed reviews)." \
  "high" \
  "campaign,reviews,levin"

create_issue \
  "[Levin] Patient recall — 18+ month lapsed patients" \
  "Flux + Muse + Quill: Design patient recall campaign for Levin Eye Care. Estimated 400+ patients overdue 18+ months. Segment: (A) Diabetic/glaucoma patients — health urgency messaging, (B) Cataract-age patients 55+ — premium IOL opportunity, (C) Standard annual exam patients. 5-touch sequence across SMS, email, and direct mail for high-priority segments. Target: 12% reactivation rate = ~48 patients. Estimated revenue: $200-5000 per reactivated patient depending on procedure needs." \
  "medium" \
  "campaign,recall,levin"

create_issue \
  "[Levin] SEO baseline audit + AI readiness assessment" \
  "Compass: Run full SEO and AI readiness audit for levineyecare.com. Check: Core Web Vitals, mobile responsiveness, schema markup (LocalBusiness, Physician, MedicalProcedure), sitemap completeness, content gaps vs. competitors. Test 10 AI answer engine queries in Pikesville/Baltimore market across ChatGPT, Perplexity, Google AI Overviews. Identify: missing procedure pages (dry eye, LASIK FAQ), blog freshness (last post 6+ months ago), GBP optimization gaps (42 photos vs. competitor avg 65, only 3 Q&A answered). Deliver prioritized fix list with estimated patient impact." \
  "medium" \
  "seo,audit,levin"

create_issue \
  "[Levin] Connect all data pipelines" \
  "Flux: Set up automated data collection for Levin Eye Care. Connect: (1) Google Analytics 4 property, (2) Google Business Profile API, (3) Facebook page insights, (4) Mailchimp account, (5) Call tracking, (6) Review monitoring across Google, Yelp, Healthgrades, Vitals. Verify first successful pull from each source. Configure daily automated pulls. Ensure data flows to NSG warehouse with proper practice_id tagging." \
  "high" \
  "data,setup,levin"

create_issue \
  "[Levin] Generate April social media calendar" \
  "Quill: Create 20-post social media calendar for Levin Eye Care, April. Mix: 4 educational (Glaucoma Awareness Month content), 3 behind-the-scenes (team spotlight, new equipment showcase), 3 patient tips (spring allergy eye care, UV protection), 2 promotional (premium IOL benefits, scheduling ease), 3 community (local Pikesville events), 2 fun/engagement (eye trivia, optical illusion), 3 testimonial-style (review quote graphics). Include: captions, hashtags, image direction. Match Levin's professional but warm brand voice." \
  "medium" \
  "content,social,levin"

# ── Starwood Vision Issues (5) ──────────────────────────────────
echo ""
log_info "Starwood Vision (Dallas, TX) — Platinum Tier"

create_issue \
  "[Starwood] Build initial practice profile" \
  "Scout: Research and build complete profile for Starwood Vision. Multi-specialty practice in Dallas, TX. 8 providers, 3 locations. Current Google rating: 4.6 with 523 reviews. Need: full provider roster with specialties, procedure mix (cataract, LASIK, retina, glaucoma, pediatric, cosmetic), technology inventory (likely premium — Catalys femto laser recently purchased per meeting notes), competitive landscape in DFW market, demographics across 3 locations. Platinum tier — highest detail level. Complete within 24 hours." \
  "high" \
  "onboarding,starwood,scout"

create_issue \
  "[Starwood] Premium cataract surgery campaign" \
  "Muse + Quill: Design premium cataract/IOL marketing campaign for Starwood Vision. New Catalys femtosecond laser being installed in 6 weeks. Campaign: Week 1-2: Educational content (premium IOLs explained — PanOptix trifocal, Vivity extended depth). Week 3-4: Social proof (patient testimonials, before/after lifestyle stories). Week 5-6: Consultation CTA with landing page. Channels: Facebook/Instagram ads targeting 55+ in DFW, email to existing 55+ patient list, Google Business posts weekly, Google Ads for 'premium cataract surgery Dallas'. Budget: $2,500/month. Target: 15 premium IOL consultations/month." \
  "high" \
  "campaign,premium,starwood"

create_issue \
  "[Starwood] Improve review response SLA to 24 hours" \
  "Sentinel + Quill + Apollo: Dr. Park expressed frustration that review responses are taking 48 hours. Implement 24-hour response SLA for Starwood Vision (Platinum tier). Sentinel: configure 15-minute detection alerts for all Starwood reviews. Quill: pre-generate response templates matching Starwood's voice (professional, technology-forward, patient-centric). Apollo: set up approval workflow — 5-star reviews auto-respond after Quill drafts, 3-star and below require human review within 2 hours. Target: 100% of reviews responded within 24 hours." \
  "high" \
  "reviews,sla,starwood"

create_issue \
  "[Starwood] Connect data pipelines — 3 locations" \
  "Flux: Set up data collection for Starwood Vision across all 3 DFW locations. Each location needs: separate GA4 tracking, separate GBP listing connection, consolidated social media (1 Facebook page, 1 Instagram), Mailchimp account, call tracking per location. Challenge: ensure per-location and consolidated reporting. Verify data for all 3 locations within 48 hours. Starwood is Platinum tier — data freshness SLA is 15 minutes." \
  "high" \
  "data,setup,starwood"

create_issue \
  "[Starwood] Quarterly performance report — Q1" \
  "Oracle + Flux: Generate Q1 performance report for Starwood Vision. Metrics needed: review velocity (monthly breakdown), rating trend, website traffic by location, organic vs. paid split, top landing pages, email campaign performance (all Q1 sends), social engagement trends, patient call volume by location, premium procedure consultation bookings. Compare to portfolio benchmarks (Platinum tier cohort). Highlight: new Catalys laser launch prep, review SLA improvement, competitive position in DFW market. Deliver within 5 business days of quarter end." \
  "medium" \
  "reporting,starwood"

# ── Pacific Eye Associates Issues (5) ──────────────────────────
echo ""
log_info "Pacific Eye Associates (San Diego, CA) — Gold Tier"

create_issue \
  "[Pacific Eye] Build initial practice profile" \
  "Scout: Research and build complete profile for Pacific Eye Associates. Ophthalmology practice in San Diego, CA. 5 providers, 2 locations. Current Google rating: 4.3 with 341 reviews. Need: provider roster and specialties, procedure mix, technology inventory, competitive landscape (ClearVision Center is aggressive competitor — just hit 500 reviews). Demographics: San Diego market, military/veteran population (proximity to bases), tourism-adjacent. Note: 3 new competing practices opened within 10 miles in last 6 months. Gold tier. Complete within 24 hours." \
  "high" \
  "onboarding,pacific-eye,scout"

create_issue \
  "[Pacific Eye] Competitive response to ClearVision Center" \
  "Athena + Muse: ClearVision Center just hit 500 Google reviews (was 420 last month) and improved rating from 4.3 to 4.5. They now outrank Pacific Eye on Google Maps for 'eye doctor San Diego.' Design competitive response: (1) Accelerate review generation — target 20+/month for next 3 months, (2) Content differentiation — identify services Pacific Eye offers that ClearVision doesn't, (3) GBP optimization sprint — photos, Q&A, posts, (4) Explore LASIK marketing (Pacific Eye hasn't marketed aggressively but ClearVision pushes it). Deliver competitive response plan within 72 hours." \
  "high" \
  "competitive,strategy,pacific-eye"

create_issue \
  "[Pacific Eye] SEO audit + content gap analysis" \
  "Compass: Pacific Eye ranks #4 for 'eye doctor San Diego' (target: top 3). Run full audit. Known gaps: competitor #1 has DA 42 vs. Pacific Eye DA 28, competitor has 15-page procedure library vs. Pacific Eye's 6 pages. Needed: technical SEO audit, content gap analysis (likely missing: diabetic eye care, children's eye health, eye floaters, macular degeneration pages), local SEO check (NAP consistency, citation audit), AI answer engine test in San Diego market. Deliver: prioritized action plan with 'quick wins' list. Target: top 3 ranking within 6 months." \
  "medium" \
  "seo,competitive,pacific-eye"

create_issue \
  "[Pacific Eye] Monthly review campaign — April" \
  "Apollo + Quill: Launch April review generation campaign for Pacific Eye Associates. Current: 341 reviews, 4.3 rating. Competitor benchmark: ClearVision at 500 reviews, 4.5 rating. Aggressive target: 20+ new reviews in April. Strategy: expand SMS-first approach (San Diego demographics skew younger for text engagement), add bilingual review requests (significant Spanish-speaking patient base), include post-surgical patients in separate high-touch sequence. Pre-screening enabled (rating at 4.3, can't afford more 1-2 star reviews without routing to feedback first)." \
  "high" \
  "campaign,reviews,pacific-eye"

create_issue \
  "[Pacific Eye] Schedule QBR and prep materials" \
  "Relay: Schedule Q1 Quarterly Business Review with Pacific Eye Associates. Attendees: practice owner, office manager, NSG account manager and strategist. Prepare: (1) Q1 performance deck (request from Oracle), (2) Competitive landscape update showing ClearVision growth (request from Scout), (3) Proposed Q2 campaign roadmap (request from Muse), (4) SEO audit findings if ready (request from Compass), (5) Budget review and Q2 recommendations (request from Atlas). Send invite with pre-read materials 1 week before meeting. Suggested agenda: 45 minutes." \
  "medium" \
  "meeting,qbr,pacific-eye"

# ── Step 5: Summary ──────────────────────────────────────────────

log_step "Step 5/5: Setup Complete!"
echo ""
echo -e "  ${GREEN}✓${NC} 1 company:    NSG AI Operations"
echo -e "  ${GREEN}✓${NC} 12 agents:    Atlas, Athena, Apollo, Oracle, Scout, Echo,"
echo -e "               Muse, Quill, Flux, Sentinel, Compass, Relay"
echo -e "  ${GREEN}✓${NC} 5 goals:      Rating 4.7+, 15+ reviews/mo, 50% AI citations,"
echo -e "               12% patient recall, 40% cost reduction"
echo -e "  ${GREEN}✓${NC} 16 issues:    6 Levin Eye Care, 5 Starwood Vision,"
echo -e "               5 Pacific Eye Associates"
echo ""
echo -e "  ${CYAN}Dashboard:${NC} ${API_URL}"
echo ""
echo -e "  Next steps:"
echo -e "    1. Open the Paperclip dashboard and select 'NSG AI Operations'"
echo -e "    2. Configure agent adapters (Hermes, OpenClaw, or Claude)"
echo -e "    3. Review and assign the 16 backlog issues"
echo -e "    4. Set budget allocations per practice tier"
echo -e "    5. Activate agents and watch the swarm work"
echo ""
log_info "Run 'pnpm dev' from the repo root to start the Paperclip server"
echo ""
