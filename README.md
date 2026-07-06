# Supply Chain Risk Intelligence

An end-to-end supply chain risk monitoring and ingestion pipeline. The system queries live search articles for suppliers using the Brave News Search API, publishes events to a Google Cloud Pub/Sub topic, and processes payloads through a secure Agent Development Kit (ADK) agent pipeline running Gemini 3.1 Flash Lite. The extracted risk metrics, sentiment ratings, and manager alert flags are merged into Google Cloud BigQuery and visualized on a dynamic local React dashboard.

## Architecture

```
  News Fetcher → Pub/Sub Topic → Risk Agent → BigQuery
                                                  ↓
                                            Dashboard (FastAPI + React)
```

![Pipeline Architecture Diagram](images/Architecture%20diagram%20(Mermaid).png)

## Prerequisites

Ensure you have the following installed on your machine:
- **Python 3.11+**
- **Node.js 18+ and npm**
- **Google Cloud account** with billing enabled (or a personal sandbox project)
- **gcloud CLI** installed and authenticated
- **A Gemini API Key** (free tier works, get at [aistudio.google.com](https://aistudio.google.com))
- **A Brave Search API Key** (free tier works, get at [brave.com/search/api](https://brave.com/search/api))

---

## Google Cloud Setup (one-time)

Follow these steps to set up the required cloud resources:

1. **Log in to gcloud CLI and set your active project:**
   ```bash
   gcloud auth list
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

2. **Enable the required BigQuery and Pub/Sub APIs:**
   ```bash
   gcloud services enable bigquery.googleapis.com pubsub.googleapis.com
   ```

3. **Create the Pub/Sub topic:**
   ```bash
   gcloud pubsub topics create supply-chain-news
   ```

4. **Create the BigQuery dataset:**
   ```bash
   bq mk --dataset YOUR_PROJECT_ID:supply_chain_risk
   ```

5. **Create a local service account with editor credentials:**
   ```bash
   gcloud iam service-accounts create local-dev \
     --display-name "Local Dev"
   ```

6. **Grant the service account BigQuery and Pub/Sub IAM roles:**
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

7. **Download the credentials JSON file:**
   ```bash
   gcloud iam service-accounts keys create credentials.json \
     --iam-account local-dev@YOUR_PROJECT_ID.iam.gserviceaccount.com
   ```
   *Move the downloaded `credentials.json` file to the root of the project.*

---

## Environment Setup

Configure the `.env` configuration file inside each directory. Copy the examples provided and replace the placeholder values:

1. **Root Directory:**
   ```bash
   cp .env.example .env
   ```

2. **News Fetcher Service:**
   ```bash
   cd news_fetcher
   cp .env.example .env
   cd ..
   ```

3. **Risk Agent Service:**
   ```bash
   cd risk_agent
   cp .env.example .env
   cd ..
   ```

---

## Running the Project

### Option A — Run everything with one command (recommended)

1. **Install all dependencies:**
   ```bash
   make install
   ```

2. **Run all services locally in parallel:**
   ```bash
   make dev
   ```
   This will start:
   - **Dashboard Service:** [http://localhost:8002](http://localhost:8002)
   - **News Fetcher:** [http://localhost:8001](http://localhost:8001)
   - **Risk Agent:** [http://localhost:8003](http://localhost:8003)
   - **Pub/Sub Forwarder:** Pulls messages from the cloud topic and forwards to the local Risk Agent.

---

### Option B — Run each service manually

If you prefer to start each service in its own terminal window:

* **Terminal 1 — Dashboard Service:**
  ```bash
  cd risk_dashboard
  uv sync
  cd frontend
  npm install
  npm run build
  cd ..
  uv run uvicorn main:app --reload --port 8002
  ```

* **Terminal 2 — News Fetcher:**
  ```bash
  cd news_fetcher
  uv sync
  uv run uvicorn main:app --reload --port 8001
  ```

* **Terminal 3 — Risk Agent:**
  ```bash
  cd risk_agent
  uv sync
  uv run uvicorn main:app --reload --port 8003
  ```

* **Terminal 4 — Pub/Sub Forwarder (Relay):**
  ```bash
  # From project root
  uv run python forward_pubsub.py
  ```

---

## Triggering the Pipeline

Once all services are active:

* **Option 1 (Command Line):**
  Trigger the news fetcher manually using `curl`:
  ```bash
  curl -X POST http://localhost:8001/run
  ```

* **Option 2 (Dashboard UI):**
  Open [http://localhost:8002](http://localhost:8002) in your browser and click the **Simulate Event** button to publish a simulated event directly to the Pub/Sub topic.

---

## Verifying It Works

1. Open [http://localhost:8002](http://localhost:8002).
2. Add a new supplier (e.g., `TSMC`, Country: `Taiwan`, Category: `Semiconductors`).
3. Click **Scan All** (or scan that row individually).
4. Watch the risk level badge update from `PENDING` to a real risk evaluation level (e.g., `LOW` or `MEDIUM` depending on live search results).
5. Switch to the **Risk Intelligence** tab to view the live Event Stream and generated Manager Alerts.

---

## Evaluation Results

The Risk Agent is evaluated using a local dataset of 6 synthetic test cases. The judge graded each case on a scale of 1-5 across three metrics (Sentiment Accuracy, Risk Level Accuracy, and Security Node Compliance):

![Evaluation Scorecard Results](images/eval%20scorecard%20results.PNG)


