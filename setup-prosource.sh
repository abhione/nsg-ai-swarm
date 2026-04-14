#!/bin/bash
# Setup Prosource AI Staffing company in Paperclip
set -e

API="http://localhost:3100/api"

echo "=== Creating Company ==="
COMPANY=$(curl -s -X POST "$API/companies" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Prosource AI Staffing",
    "description": "Build the most efficient AI-powered IT staffing operation, placing top tech talent at enterprise clients across South Florida and beyond",
    "budgetMonthlyCents": 37500
  }')
COMPANY_ID=$(echo "$COMPANY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Company ID: $COMPANY_ID"

echo ""
echo "=== Creating Agents ==="

# 1. Chief Staffing Officer (CSO) — CEO role
CSO=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Chief Staffing Officer",
    "role": "ceo",
    "title": "CSO — Chief Staffing Officer",
    "icon": "crown",
    "capabilities": "Top-level strategist. Reviews placements, approves BD targets, sets quarterly goals. Oversees all staffing operations for Prosource IT clients including Ward Electric, Broward Health, Starwood Hotels, and Miami Dade County.",
    "adapterType": "process",
    "budgetMonthlyCents": 5000,
    "runtimeConfig": {"heartbeat": {"enabled": true, "intervalSec": 14400}}
  }')
CSO_ID=$(echo "$CSO" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "CSO: $CSO_ID"

# 2. Senior Talent Scout
SCOUT=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Senior Talent Scout\",
    \"role\": \"researcher\",
    \"title\": \"Senior Talent Scout\",
    \"icon\": \"search\",
    \"reportsTo\": \"$CSO_ID\",
    \"capabilities\": \"Sources candidates from job boards, LinkedIn, GitHub, Dice, and Indeed. Identifies top tech talent for open positions. Specializes in DevOps, cybersecurity, cloud, and full-stack developer roles.\",
    \"adapterType\": \"process\",
    \"budgetMonthlyCents\": 5000,
    \"runtimeConfig\": {\"heartbeat\": {\"enabled\": true, \"intervalSec\": 7200}}
  }")
SCOUT_ID=$(echo "$SCOUT" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Talent Scout: $SCOUT_ID"

# 3. Resume Screener
SCREENER=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Resume Screener\",
    \"role\": \"qa\",
    \"title\": \"Resume Screener\",
    \"icon\": \"eye\",
    \"reportsTo\": \"$CSO_ID\",
    \"capabilities\": \"Scores candidates against job requirements, generates match reports. Parses resumes, evaluates skills alignment, produces candidate scorecards with recommendations.\",
    \"adapterType\": \"process\",
    \"budgetMonthlyCents\": 4000,
    \"runtimeConfig\": {\"heartbeat\": {\"enabled\": true, \"intervalSec\": 3600}}
  }")
SCREENER_ID=$(echo "$SCREENER" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Resume Screener: $SCREENER_ID"

# 4. Interview Coordinator
INTERVIEW=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Interview Coordinator\",
    \"role\": \"pm\",
    \"title\": \"Interview Coordinator\",
    \"icon\": \"mail\",
    \"reportsTo\": \"$CSO_ID\",
    \"capabilities\": \"Schedules interviews, sends prep materials to candidates, coordinates with hiring managers, follows up on interview outcomes. Manages the full interview pipeline.\",
    \"adapterType\": \"process\",
    \"budgetMonthlyCents\": 3000,
    \"runtimeConfig\": {\"heartbeat\": {\"enabled\": true, \"intervalSec\": 7200}}
  }")
INTERVIEW_ID=$(echo "$INTERVIEW" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Interview Coordinator: $INTERVIEW_ID"

# 5. BD Representative
BD=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"BD Representative\",
    \"role\": \"general\",
    \"title\": \"Business Development Representative\",
    \"icon\": \"target\",
    \"reportsTo\": \"$CSO_ID\",
    \"capabilities\": \"Prospects new clients, researches companies needing IT staffing, drafts personalized outreach emails and sequences. Focuses on enterprise clients in South Florida.\",
    \"adapterType\": \"process\",
    \"budgetMonthlyCents\": 4000,
    \"runtimeConfig\": {\"heartbeat\": {\"enabled\": true, \"intervalSec\": 10800}}
  }")
BD_ID=$(echo "$BD" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "BD Rep: $BD_ID"

# 6. Account Manager
ACCOUNT=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Account Manager\",
    \"role\": \"general\",
    \"title\": \"Account Manager\",
    \"icon\": \"heart\",
    \"reportsTo\": \"$CSO_ID\",
    \"capabilities\": \"Manages existing client relationships with Ward Electric, Broward Health, Starwood Hotels, and Miami Dade County. Handles check-ins, satisfaction tracking, and upselling additional staffing services.\",
    \"adapterType\": \"process\",
    \"budgetMonthlyCents\": 3500,
    \"runtimeConfig\": {\"heartbeat\": {\"enabled\": true, \"intervalSec\": 14400}}
  }")
ACCOUNT_ID=$(echo "$ACCOUNT" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Account Manager: $ACCOUNT_ID"

# 7. Compliance Officer
COMPLIANCE=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Compliance Officer\",
    \"role\": \"general\",
    \"title\": \"Compliance Officer\",
    \"icon\": \"shield\",
    \"reportsTo\": \"$CSO_ID\",
    \"capabilities\": \"Tracks I-9 verification, background checks, certifications, and regulatory compliance for all placements. Ensures 95%+ compliance rate across all active staffing engagements.\",
    \"adapterType\": \"process\",
    \"budgetMonthlyCents\": 3000,
    \"runtimeConfig\": {\"heartbeat\": {\"enabled\": true, \"intervalSec\": 21600}}
  }")
COMPLIANCE_ID=$(echo "$COMPLIANCE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Compliance Officer: $COMPLIANCE_ID"

# 8. Onboarding Specialist
ONBOARD=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Onboarding Specialist\",
    \"role\": \"general\",
    \"title\": \"Onboarding Specialist\",
    \"icon\": \"rocket\",
    \"reportsTo\": \"$CSO_ID\",
    \"capabilities\": \"Handles new hire paperwork, orientation scheduling, equipment provisioning, and first-week check-ins. Ensures smooth transitions for placed IT professionals.\",
    \"adapterType\": \"process\",
    \"budgetMonthlyCents\": 2500,
    \"runtimeConfig\": {\"heartbeat\": {\"enabled\": true, \"intervalSec\": 14400}}
  }")
ONBOARD_ID=$(echo "$ONBOARD" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Onboarding Specialist: $ONBOARD_ID"

# 9. Job Description Writer
JD_WRITER=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Job Description Writer\",
    \"role\": \"general\",
    \"title\": \"Job Description Writer\",
    \"icon\": \"sparkles\",
    \"reportsTo\": \"$CSO_ID\",
    \"capabilities\": \"Creates compelling, inclusive job descriptions from client requirements. Optimizes postings for job board search visibility on Indeed, LinkedIn, and Dice.\",
    \"adapterType\": \"process\",
    \"budgetMonthlyCents\": 3000,
    \"runtimeConfig\": {\"heartbeat\": {\"enabled\": true, \"intervalSec\": 10800}}
  }")
JD_WRITER_ID=$(echo "$JD_WRITER" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "JD Writer: $JD_WRITER_ID"

# 10. Social Media Manager
SOCIAL=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Social Media Manager\",
    \"role\": \"cmo\",
    \"title\": \"Social Media Manager\",
    \"icon\": \"globe\",
    \"reportsTo\": \"$CSO_ID\",
    \"capabilities\": \"Posts job openings on LinkedIn and social channels, creates company updates, shares industry content, and builds employer brand for Prosource IT.\",
    \"adapterType\": \"process\",
    \"budgetMonthlyCents\": 2500,
    \"runtimeConfig\": {\"heartbeat\": {\"enabled\": true, \"intervalSec\": 14400}}
  }")
SOCIAL_ID=$(echo "$SOCIAL" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Social Media Manager: $SOCIAL_ID"

# 11. Performance Analyst
ANALYST=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Performance Analyst\",
    \"role\": \"researcher\",
    \"title\": \"Performance Analyst\",
    \"icon\": \"target\",
    \"reportsTo\": \"$CSO_ID\",
    \"capabilities\": \"Tracks KPIs including time-to-fill, placement rate, revenue per recruiter, client satisfaction scores. Generates weekly and quarterly performance reports.\",
    \"adapterType\": \"process\",
    \"budgetMonthlyCents\": 2000,
    \"runtimeConfig\": {\"heartbeat\": {\"enabled\": true, \"intervalSec\": 21600}}
  }")
ANALYST_ID=$(echo "$ANALYST" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Performance Analyst: $ANALYST_ID"

echo ""
echo "=== Creating Goals ==="

# Company-level goal
GOAL_MAIN=$(curl -s -X POST "$API/companies/$COMPANY_ID/goals" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Place 50 IT professionals at enterprise clients in Q2 2026\",
    \"description\": \"Primary company objective: successfully place 50 qualified IT professionals at enterprise clients including Ward Electric, Broward Health, Starwood Hotels, and Miami Dade County during Q2 2026.\",
    \"level\": \"company\",
    \"status\": \"active\",
    \"ownerAgentId\": \"$CSO_ID\"
  }")
GOAL_MAIN_ID=$(echo "$GOAL_MAIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Main Goal: $GOAL_MAIN_ID"

# Sub-goals
GOAL_SOURCE=$(curl -s -X POST "$API/companies/$COMPANY_ID/goals" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Source 200 qualified candidates for open positions\",
    \"description\": \"Build a pipeline of 200+ qualified IT professionals across DevOps, cybersecurity, cloud engineering, and full-stack development roles.\",
    \"level\": \"team\",
    \"status\": \"active\",
    \"parentId\": \"$GOAL_MAIN_ID\",
    \"ownerAgentId\": \"$SCOUT_ID\"
  }")
GOAL_SOURCE_ID=$(echo "$GOAL_SOURCE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Source Goal: $GOAL_SOURCE_ID"

GOAL_CLIENTS=$(curl -s -X POST "$API/companies/$COMPANY_ID/goals" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Close 10 new client contracts\",
    \"description\": \"Expand Prosource IT client base by closing 10 new enterprise IT staffing contracts in South Florida.\",
    \"level\": \"team\",
    \"status\": \"active\",
    \"parentId\": \"$GOAL_MAIN_ID\",
    \"ownerAgentId\": \"$BD_ID\"
  }")
GOAL_CLIENTS_ID=$(echo "$GOAL_CLIENTS" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Clients Goal: $GOAL_CLIENTS_ID"

GOAL_COMPLIANCE=$(curl -s -X POST "$API/companies/$COMPANY_ID/goals" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Maintain 95% compliance rate on all placements\",
    \"description\": \"Ensure all placed candidates have completed I-9 verification, background checks, and required certifications with a 95%+ compliance rate.\",
    \"level\": \"team\",
    \"status\": \"active\",
    \"parentId\": \"$GOAL_MAIN_ID\",
    \"ownerAgentId\": \"$COMPLIANCE_ID\"
  }")
GOAL_COMPLIANCE_ID=$(echo "$GOAL_COMPLIANCE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Compliance Goal: $GOAL_COMPLIANCE_ID"

GOAL_TTF=$(curl -s -X POST "$API/companies/$COMPANY_ID/goals" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Reduce average time-to-fill to under 15 days\",
    \"description\": \"Optimize the recruitment pipeline to achieve an average time-to-fill of less than 15 business days from req open to candidate start.\",
    \"level\": \"team\",
    \"status\": \"active\",
    \"parentId\": \"$GOAL_MAIN_ID\",
    \"ownerAgentId\": \"$ANALYST_ID\"
  }")
GOAL_TTF_ID=$(echo "$GOAL_TTF" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "TTF Goal: $GOAL_TTF_ID"

echo ""
echo "=== Creating Tickets ==="

# Ticket 1: Source DevOps Engineers
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Source 5 Senior DevOps Engineers for Broward Health cloud migration project\",
    \"description\": \"Broward Health is migrating their infrastructure to AWS. They need 5 Senior DevOps Engineers with experience in:\n- AWS (EC2, ECS, Lambda, CloudFormation)\n- Kubernetes/Docker\n- CI/CD pipelines (Jenkins, GitHub Actions)\n- HIPAA compliance\n- Terraform/IaC\n\nTarget: 15+ qualified candidates in pipeline within 2 weeks.\nBudget: $150-180k salary range.\nLocation: Hybrid (Fort Lauderdale, FL)\",
    \"status\": \"backlog\",
    \"priority\": \"high\",
    \"assigneeAgentId\": \"$SCOUT_ID\",
    \"goalId\": \"$GOAL_SOURCE_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Ticket 1: {d[\"id\"]}')"

# Ticket 2: Screen cybersecurity applications
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Screen 12 incoming applications for Miami Dade County cybersecurity analyst role\",
    \"description\": \"Miami Dade County has 12 incoming applications for their Cybersecurity Analyst position. Screen each candidate against these requirements:\n- CISSP, CEH, or CompTIA Security+ certification\n- 3+ years SOC experience\n- SIEM tools (Splunk, QRadar)\n- Incident response procedures\n- Government/public sector clearance preferred\n\nDeliver: Scored candidate matrix with top 5 recommendations.\",
    \"status\": \"backlog\",
    \"priority\": \"high\",
    \"assigneeAgentId\": \"$SCREENER_ID\",
    \"goalId\": \"$GOAL_SOURCE_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Ticket 2: {d[\"id\"]}')"

# Ticket 3: Draft BD outreach for Ward Electric
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Draft outreach email sequence for Ward Electric IT modernization pitch\",
    \"description\": \"Ward Electric is undergoing IT modernization. Draft a 3-email outreach sequence:\n\nEmail 1: Introduction — position Prosource as their IT staffing partner for the modernization\nEmail 2: Value prop — case studies from similar industrial/utility clients\nEmail 3: Meeting request — propose a 30-min discovery call\n\nTarget contact: IT Director or CTO\nTone: Professional but warm, emphasizing South Florida local presence\nInclude: Relevant tech roles we can fill (cloud architects, network engineers, security specialists)\",
    \"status\": \"backlog\",
    \"priority\": \"medium\",
    \"assigneeAgentId\": \"$BD_ID\",
    \"goalId\": \"$GOAL_CLIENTS_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Ticket 3: {d[\"id\"]}')"

# Ticket 4: Create job posting for Full Stack Developer
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Create job posting for Full Stack Developer (React/Node) at Starwood Hotels\",
    \"description\": \"Starwood Hotels needs a Full Stack Developer for their guest experience platform team.\n\nRequirements to highlight:\n- React 18+, TypeScript, Node.js\n- REST APIs and GraphQL\n- PostgreSQL, Redis\n- AWS services (S3, Lambda, CloudFront)\n- Experience with hospitality/travel tech a plus\n\nCompensation: \$130-155k + benefits\nLocation: Remote with occasional Miami office visits\n\nCreate an engaging, inclusive job posting optimized for LinkedIn and Indeed search.\",
    \"status\": \"backlog\",
    \"priority\": \"medium\",
    \"assigneeAgentId\": \"$JD_WRITER_ID\",
    \"goalId\": \"$GOAL_SOURCE_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Ticket 4: {d[\"id\"]}')"

# Ticket 5: Generate Q1 performance report
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Generate Q1 2026 placement performance report\",
    \"description\": \"Compile and analyze Q1 2026 staffing metrics:\n\n- Total placements made\n- Average time-to-fill by role type\n- Placement success rate (still employed after 90 days)\n- Revenue per placement\n- Client satisfaction scores\n- Cost per hire\n- Pipeline conversion rates (sourced → screened → interviewed → placed)\n\nFormat: Executive summary + detailed breakdown by client (Ward Electric, Broward Health, Starwood Hotels, Miami Dade County)\nInclude: Trend charts and recommendations for Q2 optimization\",
    \"status\": \"backlog\",
    \"priority\": \"medium\",
    \"assigneeAgentId\": \"$ANALYST_ID\",
    \"goalId\": \"$GOAL_TTF_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Ticket 5: {d[\"id\"]}')"

echo ""
echo "=== Setup Complete ==="
echo "Company: Prosource AI Staffing ($COMPANY_ID)"
echo "Agents: 11 created"
echo "Goals: 5 created (1 company + 4 sub-goals)"
echo "Tickets: 5 created and assigned"
echo ""
echo "Dashboard: http://localhost:3100"
