import os
import asyncio
import base64
import datetime
import json
import logging
from typing import Any, Literal

from google import genai
from google.adk.agents.context import Context
from google.adk.apps import App
from google.adk.events.event import Event
from google.adk.workflow import Workflow, node
from google.genai import types
from pydantic import BaseModel, Field
from google.cloud import bigquery

from risk_agent.config import (
    ACTION_HIGH,
    ACTION_LOW,
    ACTION_MEDIUM,
    ALERT_MODEL_NAME,
    ANALYZE_MODEL_NAME,
    HIGH_SEVERITY_EVENTS,
    MED_SEVERITY_EVENTS,
    SCORE_HIGH_SEVERITY,
    SCORE_MED_SEVERITY,
    SCORE_NEGATIVE,
    SCORE_NEUTRAL,
    THRESHOLD_LOW,
    THRESHOLD_MEDIUM,
)

# Import the MCP server instance
from risk_agent.mcp_tools import mcp

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("risk_agent")

PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("PROJECT_ID", "ringed-tuner-499715-h9")
DATASET_ID = os.getenv("BIGQUERY_DATASET") or os.getenv("BIGQUERY_DATASET_NAME", "supply_chain")

# Pydantic Schemas for Gemini Structured Output (Stage 2)
class EntitiesSchema(BaseModel):
    locations: list[str] = Field(default_factory=list)
    event_types: list[Literal["flood", "strike", "bankruptcy", "port_closure", "political_unrest", "factory_fire", "shortage"]] = Field(default_factory=list)
    industries: list[str] = Field(default_factory=list)

class AnalysisResponseSchema(BaseModel):
    sentiment: Literal["NEGATIVE", "NEUTRAL", "POSITIVE"]
    confidence: float
    summary: str
    entities: EntitiesSchema

def parse_pubsub_payload(node_input: Any) -> dict:
    """Parses a Pub/Sub message payload supporting base64 and plain JSON formats."""
    raw_str = ""
    if hasattr(node_input, "parts") and node_input.parts:
        raw_str = node_input.parts[0].text or ""
    elif isinstance(node_input, str):
        raw_str = node_input
    elif isinstance(node_input, dict):
        payload_dict = node_input
    else:
        raw_str = str(node_input)

    if raw_str:
        raw_str = raw_str.strip()
        try:
            payload_dict = json.loads(raw_str)
        except Exception:
            try:
                decoded = base64.b64decode(raw_str).decode('utf-8')
                payload_dict = json.loads(decoded)
            except Exception as decode_err:
                raise ValueError(f"Could not parse payload as JSON. Content: {raw_str}") from decode_err

    if isinstance(payload_dict, dict):
        msg = payload_dict.get("message")
        if isinstance(msg, dict) and "data" in msg:
            data = msg["data"]
        elif "data" in payload_dict:
            data = payload_dict["data"]
        else:
            data = None

        if data and isinstance(data, str):
            try:
                decoded_data = base64.b64decode(data).decode('utf-8')
                payload_dict = json.loads(decoded_data)
            except Exception:
                try:
                    payload_dict = json.loads(data)
                except Exception:
                    pass
        elif isinstance(data, dict):
            payload_dict = data

    if not isinstance(payload_dict, dict):
        raise ValueError("Payload is not a valid JSON object/dictionary")

    return {
        "supplier_name": payload_dict.get("supplier_name", ""),
        "country": payload_dict.get("country", ""),
        "category": payload_dict.get("category", ""),
        "articles": payload_dict.get("articles", []),
        "article_count": payload_dict.get("article_count", 0),
        "fetched_at": payload_dict.get("fetched_at", "")
    }

# ----------------- WORKFLOW NODES -----------------

@node
async def security_node(ctx: Context, node_input: Any) -> Event:
    """Stage 0: Checks for prompt injection and validates required fields via MCP BigQuery tools."""
    # Try to parse the payload
    try:
        clean_event = parse_pubsub_payload(node_input)
    except Exception as e:
        error_msg = f"ERROR: missing required fields: [Invalid JSON format or could not parse payload: {e}]"
        row = {
            "timestamp": datetime.datetime.utcnow(),
            "supplier_name": "ERROR",
            "country": "ERROR",
            "category": "ERROR",
            "source_urls": "",
            "raw_texts": error_msg,
            "article_count": 0,
            "security_flag": False
        }
        await mcp.call_tool("bigquery_write", {"table_name": "supply_chain_events", "row": row})
        return Event(output=error_msg, route="field_error")

    # CHECK 1: Prompt injection detection (case-insensitive)
    injection_patterns = [
        "ignore previous instructions",
        "ignore all rules",
        "you are now",
        "bypass all",
        "auto-approve",
        "output low for all",
        "disregard",
        "override"
    ]

    supplier_name = clean_event.get("supplier_name", "")
    category = clean_event.get("category", "")
    country = clean_event.get("country", "")
    articles = clean_event.get("articles", [])

    injection_detected = False
    for field in [supplier_name, category]:
        if any(pattern in str(field).lower() for pattern in injection_patterns):
            injection_detected = True
            break

    if not injection_detected:
        for art in articles:
            raw_text = art.get("raw_text", "")
            if any(pattern in str(raw_text).lower() for pattern in injection_patterns):
                injection_detected = True
                break

    if injection_detected:
        logger.warning(f"SECURITY EVENT: Prompt injection attempt detected for supplier: {supplier_name}")
        source_urls_list = [art.get("source_url", "") for art in articles if art.get("source_url")]
        raw_texts_list = [art.get("raw_text", "") for art in articles if art.get("raw_text")]
        
        event_row = {
            "timestamp": datetime.datetime.utcnow(),
            "supplier_name": supplier_name,
            "country": country,
            "category": category,
            "source_urls": ", ".join(source_urls_list) if source_urls_list else "PROMPT_INJECTION_DETECTED",
            "raw_texts": f"Blocked prompt injection attempt. Joined raw texts: {' | '.join(raw_texts_list)}" if raw_texts_list else "Blocked prompt injection attempt.",
            "article_count": len(articles),
            "security_flag": True
        }
        await mcp.call_tool("bigquery_write", {"table_name": "supply_chain_events", "row": event_row})

        # Log alert to manager_alerts using MCP Tool
        alert_msg = "SECURITY EVENT: Prompt injection attempt detected in supplier data. Manual review required. Pipeline execution halted."
        alert_row = {
            "timestamp": datetime.datetime.utcnow(),
            "supplier_name": supplier_name,
            "risk_level": "HIGH",
            "alert_message": alert_msg
        }
        await mcp.call_tool("bigquery_write", {"table_name": "manager_alerts", "row": alert_row})

        return Event(output=alert_msg, route="security_violation")

    # CHECK 2: Required field validation
    missing_fields = []
    for field_name in ["supplier_name", "country", "category"]:
        val = clean_event.get(field_name)
        if not val or not isinstance(val, str) or not val.strip():
            missing_fields.append(field_name)

    if not articles:
        missing_fields.append("articles")
    else:
        for idx, art in enumerate(articles):
            if not art.get("raw_text") or not art.get("source_url"):
                missing_fields.append(f"article[{idx}].raw_text/source_url")

    if missing_fields:
        missing_str = ", ".join(missing_fields)
        error_msg = f"ERROR: missing required fields: {missing_str}"
        logger.error(error_msg)

        # Log error event with security_flag=False using MCP Tool
        event_row = {
            "timestamp": datetime.datetime.utcnow(),
            "supplier_name": supplier_name or "ERROR",
            "country": country or "ERROR",
            "category": category or "ERROR",
            "source_urls": "FIELD_VALIDATION_ERROR",
            "raw_texts": error_msg,
            "article_count": len(articles),
            "security_flag": False
        }
        await mcp.call_tool("bigquery_write", {"table_name": "supply_chain_events", "row": event_row})

        return Event(output=error_msg, route="field_error")

    # Both checks passed: proceed
    return Event(output=clean_event, route="pass")


@node
async def ingest_node(ctx: Context, node_input: dict) -> dict:
    """Stage 1: Receives parsed payload from security_node and writes ONE row to supply_chain_events via MCP."""
    clean_event = node_input
    logger.info(f"Ingested event for supplier: {clean_event['supplier_name']}")

    articles = clean_event.get("articles", [])
    source_urls_list = [art.get("source_url", "") for art in articles if art.get("source_url")]
    raw_texts_list = [art.get("raw_text", "") for art in articles if art.get("raw_text")]

    row = {
        "timestamp": datetime.datetime.utcnow(),
        "supplier_name": clean_event["supplier_name"],
        "country": clean_event["country"],
        "category": clean_event["category"],
        "source_urls": ", ".join(source_urls_list),
        "raw_texts": " | ".join(raw_texts_list),
        "article_count": len(articles),
        "security_flag": False
    }
    await mcp.call_tool("bigquery_write", {"table_name": "supply_chain_events", "row": row})

    return clean_event

@node
async def analyze_node(ctx: Context, node_input: dict) -> dict:
    """Stage 2: Sentiment analysis & Entity recognition in one LLM call using Gemini."""
    articles = node_input.get("articles", [])
    supplier_name = node_input.get("supplier_name", "Unknown Supplier")
    country = node_input.get("country", "Unknown Country")
    category = node_input.get("category", "Unknown Category")

    combined = ""
    for i, article in enumerate(articles):
        combined += f"Article {i+1}: {article['raw_text']}\n\n"

    prompt = f"""You are a supply chain risk analyst. Analyze the following {len(articles)} news articles about supplier {supplier_name} in {country} ({category}). Consider ALL articles together and provide a SINGLE holistic assessment.

Articles:
{combined}

Return ONLY a valid JSON object with this exact structure, no preamble:
{{
  "sentiment": "NEGATIVE | NEUTRAL | POSITIVE",
  "confidence": 0.0 to 1.0,
  "summary": "2-3 sentence summary combining the key themes across all articles",
  "entities": {{
    "locations": ["list of place names"],
    "event_types": ["flood | strike | bankruptcy | port_closure | political_unrest | factory_fire | shortage"],
    "industries": ["affected industries"]
  }}
}}"""

    client = genai.Client()

    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=ANALYZE_MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=AnalysisResponseSchema,
                temperature=0.1
            )
        )
        analysis_result = json.loads(response.text)
    except Exception as e:
        logger.error(f"Gemini call or JSON parsing failed in analyze_node: {e}")
        analysis_result = {
            "sentiment": "NEUTRAL",
            "confidence": 0.0,
            "summary": "Unable to analyze articles.",
            "entities": {
                "locations": [],
                "event_types": [],
                "industries": []
            }
        }

    return {
        "supplier_name": supplier_name,
        "country": country,
        "category": category,
        "sentiment": analysis_result.get("sentiment", "NEUTRAL"),
        "confidence": analysis_result.get("confidence", 0.0),
        "summary": analysis_result.get("summary", "Unable to analyze articles."),
        "entities": analysis_result.get("entities", {"locations": [], "event_types": [], "industries": []})
    }

@node
async def risk_score_node(ctx: Context, node_input: dict) -> dict:
    """Stage 3: Compute risk score using Python logic and log to BigQuery via MCP."""
    sentiment = node_input.get("sentiment", "NEUTRAL")
    entities = node_input.get("entities", {"locations": [], "event_types": [], "industries": []})
    supplier_name = node_input.get("supplier_name", "Unknown Supplier")
    country = node_input.get("country", "Unknown Country")
    category = node_input.get("category", "Unknown Category")
    confidence = node_input.get("confidence", 0.0)
    summary = node_input.get("summary", "")

    # Compute risk score
    score = 0
    if sentiment == "NEGATIVE":
        score += SCORE_NEGATIVE
    elif sentiment == "NEUTRAL":
        score += SCORE_NEUTRAL

    for event in entities.get("event_types", []):
        if event in HIGH_SEVERITY_EVENTS:
            score += SCORE_HIGH_SEVERITY
        elif event in MED_SEVERITY_EVENTS:
            score += SCORE_MED_SEVERITY

    score = min(score, 100)

    # Risk level & Recommended action
    if score <= THRESHOLD_LOW:
        risk_level = "LOW"
        recommended_action = ACTION_LOW
    elif score <= THRESHOLD_MEDIUM:
        risk_level = "MEDIUM"
        recommended_action = ACTION_MEDIUM
    else:
        risk_level = "HIGH"
        recommended_action = ACTION_HIGH

    # Include the summary context in the recommended action
    recommended_action = f"{recommended_action}. Context: {summary}"

    # Write to BigQuery table "supplier_risk_scores" via MERGE (UPSERT) MCP tool
    timestamp = datetime.datetime.utcnow()
    row = {
        "timestamp": timestamp,
        "supplier_name": supplier_name,
        "risk_level": risk_level,
        "risk_score": score,
        "sentiment": sentiment,
        "confidence": confidence,
        "entities": entities,
        "summary": summary,
        "recommended_action": recommended_action
    }
    
    try:
        await mcp.call_tool("bigquery_merge", {
            "table_name": "supplier_risk_scores",
            "match_column": "supplier_name",
            "row": row
        })
        logger.info(f"Successfully merged risk score for {supplier_name} via bigquery_merge tool.")
    except Exception as e:
        logger.error(f"Failed to merge risk score for {supplier_name}: {e}")

    return {
        "supplier_name": supplier_name,
        "country": country,
        "category": category,
        "risk_level": risk_level,
        "risk_score": score,
        "sentiment": sentiment,
        "confidence": confidence,
        "entities": entities,
        "summary": summary,
        "recommended_action": recommended_action
    }

@node
async def alert_node(ctx: Context, node_input: dict):
    """Stage 4: Write alert message and write to manager_alerts table via MCP with UPSERT."""
    risk_level = node_input.get("risk_level", "LOW")
    supplier_name = node_input.get("supplier_name", "Unknown Supplier")
    country = node_input.get("country", "Unknown Country")
    category = node_input.get("category", "Unknown Category")
    risk_score = node_input.get("risk_score", 0)
    entities = node_input.get("entities", {"locations": [], "event_types": [], "industries": []})
    event_types = ", ".join(entities.get("event_types", []))
    sentiment = node_input.get("sentiment", "NEUTRAL")
    summary = node_input.get("summary", "")

    alert_message = ""
    if risk_level in ["HIGH", "MEDIUM"]:
        client = genai.Client()
        prompt = f"""You are a supply chain risk analyst writing urgent alerts for procurement managers. Write exactly 2 short sentences.
Be direct and specific — no filler words, no long explanations.
Sentence 1: State exactly what happened and where in under 20 words.
Sentence 2: State exactly what action to take in under 15 words.
Supplier: {supplier_name} in {country} ({category}).
Risk: {risk_level} (score {risk_score}/100).
Events: {event_types}. Summary: {summary}.
Return only the 2 sentences. No labels, no preamble, no extra text."""

        try:
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=ALERT_MODEL_NAME,
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0.2)
            )
            alert_message = response.text.strip()
        except Exception as e:
            logger.error(f"Gemini call failed in alert_node: {e}")
            alert_message = f"Risk alert detected for {supplier_name} ({risk_level} risk). Immediate review is recommended. Context: {summary}"
    else:
        alert_message = "No action required."

    timestamp = datetime.datetime.utcnow()
    
    # ─── UPSERT Behavior for manager_alerts ────────────────────────
    bq_client = bigquery.Client(project=PROJECT_ID)
    table_ref = f"{PROJECT_ID}.{DATASET_ID}.manager_alerts"
    
    # Check if an alert already exists for this supplier from the last 24 hours
    check_query = f"""
        SELECT timestamp 
        FROM `{table_ref}`
        WHERE supplier_name = @supplier_name
        AND timestamp > DATETIME_SUB(CURRENT_DATETIME(), INTERVAL 24 HOUR)
        ORDER BY timestamp DESC
        LIMIT 1
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("supplier_name", "STRING", supplier_name)
        ]
    )
    
    recent_alerts = []
    try:
        query_job = bq_client.query(check_query, job_config=job_config)
        recent_alerts = list(query_job.result())
    except Exception as e:
        logger.warning(f"Error checking recent alerts: {e}")
        
    has_recent = len(recent_alerts) > 0
    
    if has_recent:
        # Update the most recent alert
        recent_timestamp = recent_alerts[0].timestamp
        update_query = f"""
            UPDATE `{table_ref}`
            SET alert_message = @alert_message, timestamp = @timestamp, risk_level = @risk_level
            WHERE supplier_name = @supplier_name
            AND timestamp = @recent_timestamp
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("alert_message", "STRING", alert_message),
                bigquery.ScalarQueryParameter("timestamp", "DATETIME", timestamp),
                bigquery.ScalarQueryParameter("risk_level", "STRING", risk_level),
                bigquery.ScalarQueryParameter("supplier_name", "STRING", supplier_name),
                bigquery.ScalarQueryParameter("recent_timestamp", "DATETIME", recent_timestamp),
            ]
        )
        try:
            query_job = bq_client.query(update_query, job_config=job_config)
            query_job.result()
            logger.info(f"Updated recent manager alert for {supplier_name} via DML.")
        except Exception as dml_err:
            if "billingNotEnabled" in str(dml_err):
                logger.info("Billing not enabled. Using Sandbox fallback for manager_alerts UPDATE.")
                try:
                    select_query = f"SELECT * FROM `{table_ref}`"
                    rows = [dict(r) for r in bq_client.query(select_query).result()]
                    
                    for r in rows:
                        if r["supplier_name"] == supplier_name and r["timestamp"] == recent_timestamp:
                            r["alert_message"] = alert_message
                            r["timestamp"] = timestamp
                            r["risk_level"] = risk_level
                            break
                            
                    for r in rows:
                        if isinstance(r["timestamp"], (datetime.datetime, datetime.date)):
                            r["timestamp"] = r["timestamp"].isoformat()
                    
                    load_config = bigquery.LoadJobConfig(
                        write_disposition="WRITE_TRUNCATE",
                        source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON
                    )
                    job = bq_client.load_table_from_json(rows, table_ref, job_config=load_config)
                    job.result()
                    logger.info(f"Updated recent manager alert for {supplier_name} via Sandbox fallback.")
                except Exception as fb_err:
                    logger.error(f"Sandbox fallback failed for manager_alerts UPDATE: {fb_err}")
            else:
                logger.error(f"Failed to update recent manager alert: {dml_err}")
    else:
        # Insert a new alert row
        row = {
            "timestamp": timestamp,
            "supplier_name": supplier_name,
            "risk_level": risk_level,
            "alert_message": alert_message
        }
        await mcp.call_tool("bigquery_write", {"table_name": "manager_alerts", "row": row})
        logger.info(f"Inserted new manager alert for {supplier_name}.")

    # Yield content event for web UI rendering, then yield output for final node output
    yield Event(
        content=types.Content(
            role='model',
            parts=[types.Part.from_text(text=alert_message)]
        ),
        output=alert_message
    )

# ----------------- WORKFLOW GRAPH DEFINITION -----------------

root_agent = Workflow(
    name="risk_workflow",
    edges=[
        ('START', security_node),
        (security_node, {"pass": ingest_node}),
        (ingest_node, analyze_node),
        (analyze_node, risk_score_node),
        (risk_score_node, alert_node)
    ],
    description="A sequential supply chain risk intelligence pipeline using ADK 2.0 with security checks and MCP BQ tools."
)

app = App(
    root_agent=root_agent,
    name="risk_agent",  # Must match the directory name
)
