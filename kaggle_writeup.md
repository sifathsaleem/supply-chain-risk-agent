# Supply Chain Risk Intelligence Multi-Agent System

## Section 1 — Problem

Global supply chains are highly vulnerable to real-world operational disruptions such as severe flooding, logistics strikes, supplier bankruptcies, and port closures. When these disruptions occur, procurement managers are often notified far too late, usually after shipments have already been delayed or halted. 

Traditional monitoring methods rely on manual news searching, delayed reporting services, or static vendor logs, none of which scale across thousands of global suppliers. Currently, there is a lack of continuous, automated systems capable of watching global news, dynamically mapping events to specific suppliers, scoring those risks, and raising real-time alerts for procurement managers before the disruption impacts production.

---

## Section 2 — Why Agents

This problem is uniquely suited to agentic systems because it requires:
- **Autonomous Action:** The system must independently query news sources and search engines for hundreds of suppliers on a schedule without requiring manual human triggers for each search.
- **Multi-Step Reasoning:** Raw search results must be filtered, duplicates must be removed, and the remaining content must be analyzed, scored for risk severity, mapped to a specific supplier, and evaluated for manager alert criteria.
- **Real-Time Continuous Operation:** The system runs continuously as background services, listening to event triggers and instantly processing news payloads.
- **Tool Use:** The agents must interact with external tools such as the Brave Search API to gather real-time data, and write structured queries to BigQuery.

A traditional chatbot cannot perform this automated, continuous loop, and a simple static API cannot handle the multi-step reasoning required to filter adversarial injections or calculate dynamic risk scores. An agentic graph pipeline natively solves these challenges.

---

## Section 3 — Architecture

The system consists of two collaborating agents and a database storage layer:
1. **News Fetcher Agent:** A scheduled service that queries the Brave Search API for live news regarding monitored suppliers, deduplicates URLs, and publishes payload envelopes to a Google Cloud Pub/Sub topic.
2. **Risk Intelligence Agent:** An ADK-based 4-stage pipeline that consumes Pub/Sub envelopes and processes them through an execution graph.

### Pipeline Architecture

```
  News Fetcher → Pub/Sub Topic → Risk Agent → BigQuery
                                                  ↓
                                            Dashboard (FastAPI + React)
```

### Risk Agent Execution Stages

- **Security Node:** Acts as a gateway. It inspects incoming payloads for prompt injections and schema validation errors (such as missing required fields). If a violation is caught, the pipeline halts immediately, skips model ingestion, and logs the security violation.
- **Ingest Node:** If the payload is clean, this stage writes the event metadata (timestamp, supplier, category, source URLs, and combined texts) to the `supply_chain_events` BigQuery table.
- **Analyze Node:** Calls the Gemini model to parse the news text, perform sentiment analysis, extract entities, and determine the context of the disruption.
- **Scoring Node:** Scores the risk on a scale of 0-100 and classifies the risk level (LOW, MEDIUM, HIGH). It writes the risk metrics to `supplier_risk_scores` (using an upsert fallback for BigQuery Sandbox) and logs critical warnings to `manager_alerts`.

---

## Section 4 — Implementation

The system is built on a modern, decoupled stack optimized for local development and rapid evaluation:
- **ADK 2.0 Graph Workflow API:** Defines the Risk Agent pipeline nodes, inputs/outputs, and conditional execution edges.
- **Brave Search API:** Used by the News Fetcher to retrieve real-time internet news articles.
- **Gemini-3.1-flash-lite:** Chosen for its low latency, cost-efficiency, and native tool-calling capabilities. It serves as both the core processing model and the judge for local evaluation runs.
- **Google Cloud BigQuery (Sandbox):** Provides persistent storage for supplier logs, risk scores, events, and alerts. Pruning and updates are synchronized via Permitted DDL (`CREATE OR REPLACE TABLE`) DML fallbacks.
- **React + Vite 7:** Hosts the frontend dashboard displaying Supplier Risk Statuses, Manager Alerts, and Live Event Streams.
- **FastAPI:** Exposes backend services for the news fetcher, risk agent, and dashboard server.
- **Pub/Sub Local Relay:** A custom python relay thread that polls the GCP Pub/Sub topic and forwards incoming payloads to the local Risk Agent trigger endpoints.

---

## Section 5 — Key Concepts Demonstrated

| Concept | Where |
| :--- | :--- |
| **Multi-agent system (ADK)** | The scheduled **News Fetcher** publishes live supplier search payloads, which are asynchronously consumed and analyzed by the **Risk Agent**. |
| **MCP Server** | The **Brave Search MCP** tool acts as the primary web intelligence interface to locate fresh news. |
| **Security features** | The **`security_node`** screens payloads for malicious inputs (prompt injections) and schema errors before invoking LLM calls. |
| **Deployability** | Designed for a clean, local developer setup using a single `make dev` command or individual service configurations. |
| **Agent skills** | Utilizes **ADK graph nodes** to manage the execution state and uses BigQuery database tools to merge tables. |
| **Antigravity** | The entire system, including the React UI, backend endpoints, and evaluation tests, was built and verified using **Antigravity**. |

---

## Section 6 — Evaluation Results

The Risk Agent is evaluated using a local dataset of 6 synthetic test cases. The judge graded each case on a scale of 1-5 across three metrics (Sentiment Accuracy, Risk Level Accuracy, and Security Node Compliance):

```
======================================================================
  SUPPLY CHAIN RISK AGENT - EVALUATION SCORECARD
======================================================================
Case ID                | Sentiment | Risk Score | Security | Overall
----------------------------------------------------------------------
case_1_flood           | 5/5       | 5/5        | 5/5      | PASS   
case_2_routine         | 5/5       | 5/5        | 5/5      | PASS   
case_3_port_strike     | 5/5       | 5/5        | 5/5      | PASS   
case_4_bankruptcy      | 5/5       | 5/5        | 5/5      | PASS   
case_5_injection       | 5/5       | 5/5        | 5/5      | PASS   
case_6_missing_field   | 5/5       | 5/5        | 5/5      | PASS   
----------------------------------------------------------------------
Average                | 5.0/5     | 5.0/5      | 5.0/5    |
======================================================================
```

The agent successfully passed all evaluation benchmarks with a perfect 5.0/5 average rating.

---

## Section 7 — Live Demo

- **Local Dashboard URL:** `http://localhost:8002`
- **GitHub Repository URL:** `https://github.com/YOUR_USERNAME/supply-chain-risk-agent`
- **How to run the project locally:**
  1. Follow the one-time Google Cloud setup steps in the `README.md` to configure your BigQuery dataset, Pub/Sub topic, and `credentials.json`.
  2. Setup your `.env` files with your Brave and Gemini API keys.
  3. Install dependencies and start all services using:
     ```bash
     make install
     make dev
     ```
  4. Open the dashboard, add a supplier, and click **Scan All** or **Simulate Event** to see the pipeline run.
