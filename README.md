# Supply Chain Risk Intelligence

An autonomous multi-agent system that monitors global news in real time, analyzes supply chain risks using Gemini AI, and displays live risk scores and alerts on an interactive dashboard.

**Track:** Agents for Business  
**Built with:** Google ADK 2.0, Gemini 2.5 Flash, MCP, Google Cloud Pub/Sub, BigQuery, React Vite 7, FastAPI

---

## How It Works

```
News Fetcher Agent
  → searches news per supplier using MCP web search
  → publishes ONE message per supplier to Pub/Sub

Pub/Sub Topic (supply-chain-news)
  → forwards messages to Risk Intelligence Agent

Risk Intelligence Agent (ADK 2.0 Graph Workflow)
  → security_node: blocks prompt injection + validates fields
  → ingest_node: writes raw event to BigQuery
  → analyze_node: Gemini sentiment analysis + entity recognition
  → risk_score_node: Python scoring algorithm (no LLM)
  → alert_node: Gemini generates manager alert

BigQuery
  → supply_chain_events
  → supplier_risk_scores (upserted — one row per supplier)
  → manager_alerts (upserted — one alert per supplier per 24h)

React Dashboard
  → reads BigQuery every 30 seconds
  → Panel 1: Live Risk Scoreboard
  → Panel 2: Manager Alerts
  → Panel 3: Live Event Stream
```

---

## Architecture Diagram

![Pipeline Architecture](images/Architecture%20diagram%20(Mermaid).png)

---

## Prerequisites

Install these before starting:

| Tool | Version | Download |
|---|---|---|
| Python | 3.11+ | python.org |
| Node.js | 18+ | nodejs.org |
| uv | latest | `pip install uv` |
| gcloud CLI | latest | cloud.google.com/sdk |
| Git | latest | git-scm.com |

You also need:
- A **Google Cloud project** (free tier works — no billing needed for BigQuery sandbox and Pub/Sub free tier)
- A **Gemini API key** — free at https://aistudio.google.com/app/apikey
- A **Brave Search API key** — free at https://brave.com/search/api (2,000 queries/month free)

---

## Google Cloud Setup (one-time)

Run all commands in PowerShell (Windows) or Terminal (Mac/Linux).

**Step 1 — Login and set project:**

Windows PowerShell:
```powershell
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

Mac/Linux:
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

**Step 2 — Enable required APIs:**

Windows PowerShell:
```powershell
gcloud services enable bigquery.googleapis.com pubsub.googleapis.com
```

Mac/Linux:
```bash
gcloud services enable bigquery.googleapis.com pubsub.googleapis.com
```

**Step 3 — Create Pub/Sub topic:**

Windows PowerShell:
```powershell
gcloud pubsub topics create supply-chain-news
```

Mac/Linux:
```bash
gcloud pubsub topics create supply-chain-news
```

**Step 4 — Create BigQuery dataset:**

Windows PowerShell:
```powershell
bq mk --dataset YOUR_PROJECT_ID:supply_chain_risk
```

Mac/Linux:
```bash
bq mk --dataset YOUR_PROJECT_ID:supply_chain_risk
```

**Step 5 — Create local service account:**

Windows PowerShell:
```powershell
gcloud iam service-accounts create local-dev --display-name "Local Dev"
```

Mac/Linux:
```bash
gcloud iam service-accounts create local-dev \
  --display-name "Local Dev"
```

**Step 6 — Grant IAM roles:**

Windows PowerShell:
```powershell
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID --member "serviceAccount:local-dev@YOUR_PROJECT_ID.iam.gserviceaccount.com" --role "roles/bigquery.dataEditor"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID --member "serviceAccount:local-dev@YOUR_PROJECT_ID.iam.gserviceaccount.com" --role "roles/bigquery.jobUser"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID --member "serviceAccount:local-dev@YOUR_PROJECT_ID.iam.gserviceaccount.com" --role "roles/pubsub.editor"
```

Mac/Linux:
```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member "serviceAccount:local-dev@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role "roles/bigquery.dataEditor"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member "serviceAccount:local-dev@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role "roles/bigquery.jobUser"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member "serviceAccount:local-dev@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role "roles/pubsub.editor"
```

**Step 7 — Download credentials:**

Windows PowerShell:
```powershell
gcloud iam service-accounts keys create credentials.json --iam-account local-dev@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

Mac/Linux:
```bash
gcloud iam service-accounts keys create credentials.json \
  --iam-account local-dev@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

Move `credentials.json` to the project root folder.

---

## Environment Variables Reference

Copy the example files and fill in your values:

**Step 1 — Root directory:**
```
cp .env.example .env
```

**Step 2 — News Fetcher:**
```
cd news_fetcher
cp .env.example .env
cd ..
```

**Step 3 — Risk Agent:**
```
cd risk_agent
cp .env.example .env
cd ..
```

**Root .env contents:**
```
GOOGLE_CLOUD_PROJECT=your_project_id
BIGQUERY_DATASET=supply_chain_risk
PUBSUB_TOPIC=supply-chain-news
GOOGLE_APPLICATION_CREDENTIALS=credentials.json
```

**news_fetcher/.env contents:**
```
GOOGLE_CLOUD_PROJECT=your_project_id
BIGQUERY_DATASET=supply_chain_risk
PUBSUB_TOPIC=supply-chain-news
BRAVE_API_KEY=your_brave_api_key
GOOGLE_APPLICATION_CREDENTIALS=../credentials.json
```

**risk_agent/.env contents:**
```
GOOGLE_CLOUD_PROJECT=your_project_id
BIGQUERY_DATASET=supply_chain_risk
GOOGLE_API_KEY=your_gemini_api_key
GOOGLE_APPLICATION_CREDENTIALS=../credentials.json
```

Get your keys from:
- Gemini API key: https://aistudio.google.com/app/apikey
- Brave API key: https://brave.com/search/api
- Project ID: run `gcloud config get-value project`

---

## Running the Project

Open 4 separate terminal windows. Run one command in each.

> **Windows users:** Use PowerShell for all terminals.
> These commands work on both Windows and Mac/Linux.

**Terminal 1 — Risk Agent (ADK pipeline):**
```
cd supply-chain-risk-agent
uv run adk web
```
Opens ADK Dev UI at http://localhost:8000

**Terminal 2 — News Fetcher:**
```
cd supply-chain-risk-agent/news_fetcher
uv run uvicorn main:app --reload --port 8001
```
News Fetcher API at http://localhost:8001

**Terminal 3 — Dashboard Backend:**
```
cd supply-chain-risk-agent/risk_dashboard
uv run uvicorn main:app --reload --port 8002
```
Dashboard API at http://localhost:8002

**Terminal 4 — Pub/Sub Forwarder:**
```
cd supply-chain-risk-agent
uv run python forward_pubsub.py
```
Forwards Pub/Sub messages to local Risk Agent

**Terminal 5 — Dashboard Frontend (development only):**
```
cd supply-chain-risk-agent/risk_dashboard/frontend
npm install
npm run dev
```
React dashboard at http://localhost:5173

> **Note:** For production mode (no Terminal 5 needed), build the frontend first:
> ```
> cd risk_dashboard/frontend
> npm run build
> cd ..
> ```
> Then open http://localhost:8002 directly.

---

## Triggering the Pipeline

Once all services are running:

**Option 1 — Trigger news fetch via command line:**

Windows PowerShell:
```powershell
curl http://localhost:8001/run -Method POST
```

Mac/Linux:
```bash
curl -X POST http://localhost:8001/run
```

**Option 2 — Trigger via dashboard:**
Open http://localhost:5173 and click the **Simulate Event** button on the Risk Intelligence tab.

**Option 3 — Test the ADK pipeline directly:**
Open http://localhost:8000 (ADK Dev UI) and send a test message directly to the risk agent pipeline.

---

## Verifying It Works

After triggering a fetch, verify each step:

**1. Check News Fetcher found articles:**
```
curl http://localhost:8001/
```
Should show `articles_published_today > 0`

**2. Check dashboard API responds:**
```
curl http://localhost:8002/api/suppliers
curl http://localhost:8002/api/risk-scores
curl http://localhost:8002/api/alerts
```
All should return JSON arrays.

**3. Check BigQuery was written:**

Windows PowerShell:
```powershell
bq query --use_legacy_sql=false "SELECT supplier_name, risk_level, timestamp FROM supply_chain_risk.supplier_risk_scores ORDER BY timestamp DESC LIMIT 5"
```

Mac/Linux:
```bash
bq query --use_legacy_sql=false \
  "SELECT supplier_name, risk_level, timestamp
   FROM supply_chain_risk.supplier_risk_scores
   ORDER BY timestamp DESC LIMIT 5"
```

**4. Open the dashboard:**
Go to http://localhost:5173
- Tab 1 (My Suppliers): Upload a CSV or add suppliers manually
- Tab 2 (Risk Intelligence): Watch risk cards appear after scanning

---

## Adding Your Own Suppliers

1. Open http://localhost:5173
2. Click **My Suppliers** tab
3. Click **Download Template** to get the CSV format
4. Fill in your suppliers:
   ```
   supplier_name,country,category
   TSMC,Taiwan,Semiconductors
   BASF,Germany,Chemicals
   Toyota,Japan,Automotive
   ```
5. Drag and drop the CSV onto the upload zone
6. Click **Upload X Suppliers**
7. Click **Scan Now**
8. Switch to **Risk Intelligence** tab
9. Watch risk scores appear within 1-2 minutes

---

## Agent Concepts Demonstrated

| Concept | Implementation |
|---|---|
| Multi-agent system (ADK) | News Fetcher Agent + Risk Intelligence Agent |
| MCP Server | google-news-trends-mcp + brave-search MCP |
| Security features | security_node blocks prompt injection |
| Agent skills | ADK 2.0 graph workflow nodes |
| Antigravity | Entire system built using Antigravity |

---

## Key Technical Decisions

**Why one Pub/Sub message per supplier?**
The News Fetcher groups all articles for one supplier into a single Pub/Sub message. This means Gemini analyzes all articles together holistically, producing one risk score per supplier instead of duplicate entries.

**Why upsert instead of insert?**
supplier_risk_scores and manager_alerts use MERGE/upsert so each supplier always has exactly one current risk score. The dashboard never shows duplicate cards.

**Why is scoring done in Python, not LLM?**
Risk scoring uses a deterministic algorithm so results are consistent and auditable. LLM is only used for nuanced tasks: sentiment analysis, entity recognition, and alert generation.

**Why security_node uses regex not LLM?**
Security decisions must never be delegated to an LLM. The security node uses simple pattern matching to block injection attempts before they can reach any AI model.

---

## Evaluation Results

The Risk Agent is evaluated using 6 synthetic test cases across 3 metrics using agents-cli LLM-as-judge evaluation.

![Evaluation Scorecard](images/eval%20scorecard%20results.PNG)

To run evaluations yourself:
```
cd risk_agent
uv run python tests/eval/generate_traces.py
```

---

## Project Structure

```
supply-chain-risk-agent/
├── risk_agent/                 # ADK 2.0 pipeline
│   ├── agent.py               # 5-node graph workflow
│   ├── config.py              # thresholds and model config
│   ├── mcp_tools.py           # BigQuery MCP tools
│   ├── main.py                # FastAPI entry point
│   └── tests/eval/            # evaluation dataset + config
├── news_fetcher/              # News search agent
│   └── main.py               # FastAPI + MCP web search
├── risk_dashboard/            # Dashboard service
│   ├── main.py               # FastAPI API endpoints
│   └── frontend/             # React Vite 7 dashboard
│       └── src/
│           ├── components/
│           │   ├── risk/     # Risk Intelligence tab
│           │   └── suppliers/ # My Suppliers tab
│           └── hooks/        # Data fetching hooks
├── forward_pubsub.py          # Local Pub/Sub relay
├── credentials.json           # GCP credentials (gitignored)
├── .env.example              # Environment template
└── README.md
```

---

## Security Notes

- `credentials.json` is gitignored — never committed to repo
- All `.env` files are gitignored — never committed to repo
- API keys are read from environment variables only
- security_node blocks prompt injection before LLM is called
- No hardcoded secrets anywhere in the codebase

---

## Technologies Used

| Technology | Purpose |
|---|---|
| Google ADK 2.0 | Agent graph workflow |
| Gemini 2.5 Flash | Sentiment analysis + alert generation |
| MCP (Model Context Protocol) | Web search + BigQuery tools |
| Google Cloud Pub/Sub | Message queue between agents |
| Google Cloud BigQuery | Persistent storage + audit trail |
| React Vite 7 | Interactive dashboard frontend |
| FastAPI | Backend API services |
| Antigravity (Google) | AI-assisted development |
