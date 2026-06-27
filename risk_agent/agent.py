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
from google.cloud import bigquery
from google.genai import types
from pydantic import BaseModel, Field

from risk_agent.config import (
    ACTION_HIGH,
    ACTION_LOW,
    ACTION_MEDIUM,
    ALERT_MODEL_NAME,
    ANALYZE_MODEL_NAME,
    BIGQUERY_DATASET_NAME,
    HIGH_SEVERITY_EVENTS,
    MED_SEVERITY_EVENTS,
    PROJECT_ID,
    SCORE_HIGH_SEVERITY,
    SCORE_MED_SEVERITY,
    SCORE_NEGATIVE,
    SCORE_NEUTRAL,
    THRESHOLD_LOW,
    THRESHOLD_MEDIUM,
)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("risk_agent")

# Pydantic Schemas for Gemini Structured Output (Stage 2)
class EntitiesSchema(BaseModel):
    locations: list[str] = Field(default_factory=list)
    event_types: list[Literal["flood", "strike", "bankruptcy", "port_closure", "political_unrest", "factory_fire", "shortage"]] = Field(default_factory=list)
    industries: list[str] = Field(default_factory=list)

class AnalysisResponseSchema(BaseModel):
    sentiment: Literal["NEGATIVE", "NEUTRAL", "POSITIVE"]
    confidence: float
    entities: EntitiesSchema

# BigQuery Table Creator/Helper
def init_bq_tables(client: bigquery.Client, dataset_id: str):
    """Ensures BigQuery dataset and tables exist."""
    dataset_ref = f"{client.project}.{dataset_id}"
    try:
        client.get_dataset(dataset_ref)
    except Exception:
        # Create dataset if missing
        dataset = bigquery.Dataset(dataset_ref)
        dataset.location = "US"
        client.create_dataset(dataset, timeout=30)
        logger.info(f"Created BigQuery dataset {dataset_id}")

    # 1. supply_chain_events
    events_ref = f"{client.project}.{dataset_id}.supply_chain_events"
    try:
        client.get_table(events_ref)
    except Exception:
        schema = [
            bigquery.SchemaField("timestamp", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("supplier_name", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("country", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("category", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("source_url", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("raw_text", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("security_flag", "BOOLEAN", mode="REQUIRED"),
        ]
        table = bigquery.Table(events_ref, schema=schema)
        client.create_table(table)
        logger.info(f"Created BigQuery table {events_ref}")

    # 2. supplier_risk_scores
    scores_ref = f"{client.project}.{dataset_id}.supplier_risk_scores"
    try:
        client.get_table(scores_ref)
    except Exception:
        schema = [
            bigquery.SchemaField("timestamp", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("supplier_name", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("risk_level", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("risk_score", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("sentiment", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("confidence", "FLOAT", mode="REQUIRED"),
            bigquery.SchemaField("entities", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("recommended_action", "STRING", mode="REQUIRED"),
        ]
        table = bigquery.Table(scores_ref, schema=schema)
        client.create_table(table)
        logger.info(f"Created BigQuery table {scores_ref}")

    # 3. manager_alerts
    alerts_ref = f"{client.project}.{dataset_id}.manager_alerts"
    try:
        client.get_table(alerts_ref)
    except Exception:
        schema = [
            bigquery.SchemaField("timestamp", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("supplier_name", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("risk_level", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("alert_message", "STRING", mode="REQUIRED"),
        ]
        table = bigquery.Table(alerts_ref, schema=schema)
        client.create_table(table)
        logger.info(f"Created BigQuery table {alerts_ref}")

async def insert_row_bq(client: bigquery.Client, table_ref: str, row: dict):
    """Inserts a single row into BigQuery using load jobs to support Sandbox/Free Tier."""
    try:
        job_config = bigquery.LoadJobConfig(
            write_disposition="WRITE_APPEND",
            source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON
        )
        job = client.load_table_from_json([row], table_ref, job_config=job_config)
        await asyncio.to_thread(job.result)
        logger.info(f"Successfully inserted row into {table_ref} via load job.")
    except Exception as e:
        logger.error(f"Failed to insert row to BigQuery table {table_ref}: {e}")

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

    if not isinstance(payload_dict, dict):
        raise ValueError("Payload is not a valid JSON object/dictionary")

    return {
        "supplier_name": payload_dict.get("supplier_name", ""),
        "country": payload_dict.get("country", ""),
        "category": payload_dict.get("category", ""),
        "source_url": payload_dict.get("source_url", ""),
        "raw_text": payload_dict.get("raw_text", ""),
        "published_date": payload_dict.get("published_date", "")
    }

# ----------------- WORKFLOW NODES -----------------

@node
async def security_node(ctx: Context, node_input: Any) -> Event:
    """Stage 0: Checks for prompt injection and validates required fields in plain Python."""
    bq_client = bigquery.Client(project=PROJECT_ID)
    init_bq_tables(bq_client, BIGQUERY_DATASET_NAME)

    # Try to parse the payload
    try:
        clean_event = parse_pubsub_payload(node_input)
    except Exception as e:
        error_msg = f"ERROR: missing required fields: [Invalid JSON format or could not parse payload: {e}]"
        table_ref = f"{bq_client.project}.{BIGQUERY_DATASET_NAME}.supply_chain_events"
        row = {
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "supplier_name": "ERROR",
            "country": "ERROR",
            "category": "ERROR",
            "source_url": "",
            "raw_text": error_msg,
            "security_flag": False
        }
        await insert_row_bq(bq_client, table_ref, row)
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
    raw_text = clean_event.get("raw_text", "")
    country = clean_event.get("country", "")
    source_url = clean_event.get("source_url", "")

    injection_detected = False
    for field in [raw_text, supplier_name, category]:
        if not isinstance(field, str):
            field = str(field)
        field_lower = field.lower()
        if any(pattern in field_lower for pattern in injection_patterns):
            injection_detected = True
            break

    if injection_detected:
        logger.warning(f"SECURITY EVENT: Prompt injection attempt detected for supplier: {supplier_name}")
        # Log event with security_flag=True
        events_ref = f"{bq_client.project}.{BIGQUERY_DATASET_NAME}.supply_chain_events"
        event_row = {
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "supplier_name": supplier_name,
            "country": country,
            "category": category,
            "source_url": source_url,
            "raw_text": raw_text,
            "security_flag": True
        }
        await insert_row_bq(bq_client, events_ref, event_row)

        # Log alert to manager_alerts
        alert_msg = "SECURITY EVENT: Prompt injection attempt detected in supplier data. Manual review required. Pipeline execution halted."
        alerts_ref = f"{bq_client.project}.{BIGQUERY_DATASET_NAME}.manager_alerts"
        alert_row = {
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "supplier_name": supplier_name,
            "risk_level": "HIGH",
            "alert_message": alert_msg
        }
        await insert_row_bq(bq_client, alerts_ref, alert_row)

        return Event(output=alert_msg, route="security_violation")

    # CHECK 2: Required field validation
    missing_fields = []
    for field_name in ["supplier_name", "country", "category", "raw_text"]:
        val = clean_event.get(field_name)
        if not val or not isinstance(val, str) or not val.strip():
            missing_fields.append(field_name)

    if missing_fields:
        missing_str = ", ".join(missing_fields)
        error_msg = f"ERROR: missing required fields: {missing_str}"
        logger.error(error_msg)

        # Log error event with security_flag=False
        events_ref = f"{bq_client.project}.{BIGQUERY_DATASET_NAME}.supply_chain_events"
        event_row = {
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "supplier_name": supplier_name or "ERROR",
            "country": country or "ERROR",
            "category": category or "ERROR",
            "source_url": source_url,
            "raw_text": error_msg,
            "security_flag": False
        }
        await insert_row_bq(bq_client, events_ref, event_row)

        return Event(output=error_msg, route="field_error")

    # Both checks passed: proceed
    return Event(output=clean_event, route="pass")


@node
async def ingest_node(ctx: Context, node_input: dict) -> dict:
    """Stage 1: Receives parsed payload from security_node and writes to supply_chain_events."""
    bq_client = bigquery.Client(project=PROJECT_ID)
    init_bq_tables(bq_client, BIGQUERY_DATASET_NAME)

    clean_event = node_input
    logger.info(f"Ingested event for supplier: {clean_event['supplier_name']}")

    table_ref = f"{bq_client.project}.{BIGQUERY_DATASET_NAME}.supply_chain_events"
    row = {
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "supplier_name": clean_event["supplier_name"],
        "country": clean_event["country"],
        "category": clean_event["category"],
        "source_url": clean_event["source_url"],
        "raw_text": clean_event["raw_text"],
        "security_flag": False
    }
    await insert_row_bq(bq_client, table_ref, row)

    return clean_event

@node
async def analyze_node(ctx: Context, node_input: dict) -> dict:
    """Stage 2: Sentiment analysis & Entity recognition in one LLM call using Gemini."""
    raw_text = node_input.get("raw_text", "")
    supplier_name = node_input.get("supplier_name", "Unknown Supplier")
    country = node_input.get("country", "Unknown Country")
    category = node_input.get("category", "Unknown Category")

    prompt = f"""
    Analyze the following text to identify potential supply chain risks.
    Perform the following tasks:
    1. Sentiment analysis: classify the text as NEGATIVE, NEUTRAL, or POSITIVE, and provide a confidence score between 0.0 and 1.0.
    2. Entity recognition: extract locations, event types, and industries affected.
       - event_types must ONLY be from this list: flood, strike, bankruptcy, port_closure, political_unrest, factory_fire, shortage. Ignore other event types.

    Text to analyze:
    {raw_text}
    """

    client = genai.Client()

    try:
        response = await client.aio.models.generate_content(
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
        "source_url": node_input.get("source_url", ""),
        "raw_text": raw_text,
        "published_date": node_input.get("published_date", ""),
        "sentiment": analysis_result.get("sentiment", "NEUTRAL"),
        "confidence": analysis_result.get("confidence", 0.0),
        "entities": analysis_result.get("entities", {"locations": [], "event_types": [], "industries": []})
    }

@node
async def risk_score_node(ctx: Context, node_input: dict) -> dict:
    """Stage 3: Compute risk score using Python logic and log to BigQuery."""
    sentiment = node_input.get("sentiment", "NEUTRAL")
    entities = node_input.get("entities", {"locations": [], "event_types": [], "industries": []})
    supplier_name = node_input.get("supplier_name", "Unknown Supplier")
    country = node_input.get("country", "Unknown Country")
    category = node_input.get("category", "Unknown Category")
    confidence = node_input.get("confidence", 0.0)

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

    # Write to BigQuery table "supplier_risk_scores"
    bq_client = bigquery.Client(project=PROJECT_ID)
    table_ref = f"{bq_client.project}.{BIGQUERY_DATASET_NAME}.supplier_risk_scores"
    row = {
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "supplier_name": supplier_name,
        "risk_level": risk_level,
        "risk_score": score,
        "sentiment": sentiment,
        "confidence": confidence,
        "entities": json.dumps(entities),
        "recommended_action": recommended_action
    }
    await insert_row_bq(bq_client, table_ref, row)

    return {
        "supplier_name": supplier_name,
        "country": country,
        "category": category,
        "risk_level": risk_level,
        "risk_score": score,
        "sentiment": sentiment,
        "confidence": confidence,
        "entities": entities,
        "recommended_action": recommended_action
    }

@node
async def alert_node(ctx: Context, node_input: dict):
    """Stage 4: Write alert message and write to manager_alerts table."""
    risk_level = node_input.get("risk_level", "LOW")
    supplier_name = node_input.get("supplier_name", "Unknown Supplier")
    country = node_input.get("country", "Unknown Country")
    category = node_input.get("category", "Unknown Category")
    risk_score = node_input.get("risk_score", 0)
    entities = node_input.get("entities", {"locations": [], "event_types": [], "industries": []})
    event_types = ", ".join(entities.get("event_types", []))
    sentiment = node_input.get("sentiment", "NEUTRAL")

    alert_message = ""
    if risk_level in ["HIGH", "MEDIUM"]:
        client = genai.Client()
        prompt = f"""You are a supply chain risk analyst. Write exactly 2 sentences for a procurement manager. Sentence 1: what was detected and where. Sentence 2: what immediate action to take. Be specific and professional.
Supplier: {supplier_name} in {country} ({category}).
Risk: {risk_level} (score {risk_score}/100).
Events detected: {event_types}. Sentiment: {sentiment}.
Return only the 2 sentences, no labels or preamble."""

        try:
            response = await client.aio.models.generate_content(
                model=ALERT_MODEL_NAME,
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0.2)
            )
            alert_message = response.text.strip()
        except Exception as e:
            logger.error(f"Gemini call failed in alert_node: {e}")
            alert_message = f"Risk alert detected for {supplier_name} ({risk_level} risk). Immediate review is recommended."
    else:
        alert_message = "No action required."

    # Write alert to BigQuery
    bq_client = bigquery.Client(project=PROJECT_ID)
    table_ref = f"{bq_client.project}.{BIGQUERY_DATASET_NAME}.manager_alerts"
    row = {
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "supplier_name": supplier_name,
        "risk_level": risk_level,
        "alert_message": alert_message
    }
    await insert_row_bq(bq_client, table_ref, row)

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
    description="A sequential supply chain risk intelligence pipeline using ADK 2.0 with security checks."
)

app = App(
    root_agent=root_agent,
    name="risk_agent",  # Must match the directory name
)
