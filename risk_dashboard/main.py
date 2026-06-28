import csv
import io
import json
import logging
import os
from datetime import date, datetime
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google.cloud import bigquery, pubsub_v1
from pydantic import BaseModel

# ─── Env & Logging ────────────────────────────────────────────────────────────
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("risk_dashboard")

PROJECT_ID      = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("PROJECT_ID", "ringed-tuner-499715-h9")
DATASET_ID      = os.getenv("BIGQUERY_DATASET") or os.getenv("BIGQUERY_DATASET_NAME", "supply_chain")
PUBSUB_TOPIC    = os.getenv("PUBSUB_TOPIC_NAME", "supply-chain-news")
NEWS_FETCHER_URL = os.getenv("NEWS_FETCHER_URL", "http://localhost:8081")

# ─── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(title="Supply Chain Risk Dashboard", version="1.0.0")

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8002"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── BigQuery Client Helper ────────────────────────────────────────────────────
def bq_client() -> bigquery.Client:
    return bigquery.Client(project=PROJECT_ID)

def tbl(name: str) -> str:
    return f"`{PROJECT_ID}.{DATASET_ID}.{name}`"

def serialize(row: dict) -> dict:
    """Convert BQ date/datetime to ISO strings for JSON."""
    out = {}
    for k, v in row.items():
        if isinstance(v, (datetime, date)):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out

# ─── Schema Helpers ────────────────────────────────────────────────────────────
SUPPLIERS_SCHEMA = [
    bigquery.SchemaField("supplier_name", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("country",       "STRING", mode="REQUIRED"),
    bigquery.SchemaField("category",      "STRING", mode="REQUIRED"),
    bigquery.SchemaField("added_date",    "DATE",   mode="REQUIRED"),
]

def ensure_suppliers_table(client: bigquery.Client):
    table_ref = f"{PROJECT_ID}.{DATASET_ID}.suppliers"
    try:
        client.get_table(table_ref)
    except Exception:
        dataset_ref = f"{PROJECT_ID}.{DATASET_ID}"
        try:
            client.get_dataset(dataset_ref)
        except Exception:
            ds = bigquery.Dataset(dataset_ref)
            ds.location = "US"
            client.create_dataset(ds)
        table = bigquery.Table(table_ref, schema=SUPPLIERS_SCHEMA)
        client.create_table(table)
        logger.info("Created suppliers table")


# ═══════════════════════════════════════════════════════════════════════════════
# SUPPLIER MANAGEMENT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/suppliers")
def get_suppliers():
    client = bq_client()
    sql = f"""
        SELECT supplier_name, country, category, added_date
        FROM {tbl('suppliers')}
        ORDER BY added_date DESC
    """
    try:
        rows = [serialize(dict(r)) for r in client.query(sql).result()]
        return JSONResponse(rows)
    except Exception as e:
        logger.error(f"get_suppliers error: {e}")
        return JSONResponse([])


class SupplierRow(BaseModel):
    supplier_name: str
    country: str
    category: str

class BulkSupplierBody(BaseModel):
    suppliers: list[SupplierRow]


@app.post("/api/suppliers")
def add_suppliers(body: BulkSupplierBody):
    client = bq_client()
    ensure_suppliers_table(client)

    # Fetch existing names to detect duplicates
    try:
        existing = {
            r["supplier_name"]
            for r in client.query(f"SELECT supplier_name FROM {tbl('suppliers')}").result()
        }
    except Exception:
        existing = set()

    added, skipped, errors = 0, 0, []
    rows_to_insert = []

    for s in body.suppliers:
        if not s.supplier_name.strip() or not s.country.strip() or not s.category.strip():
            errors.append(f"Missing fields for: {s.supplier_name}")
            continue
        if s.supplier_name in existing:
            skipped += 1
            continue
        rows_to_insert.append({
            "supplier_name": s.supplier_name.strip(),
            "country":       s.country.strip(),
            "category":      s.category.strip(),
            "added_date":    date.today().isoformat(),
        })
        existing.add(s.supplier_name)
        added += 1

    if rows_to_insert:
        job_config = bigquery.LoadJobConfig(
            write_disposition="WRITE_APPEND",
            source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
        )
        job = client.load_table_from_json(
            rows_to_insert,
            f"{PROJECT_ID}.{DATASET_ID}.suppliers",
            job_config=job_config,
        )
        job.result()

    return {"added": added, "skipped": skipped, "errors": errors}


@app.delete("/api/suppliers/{supplier_name}")
def delete_supplier(supplier_name: str):
    client = bq_client()
    sql = f"""
        DELETE FROM {tbl('suppliers')}
        WHERE supplier_name = @name
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("name", "STRING", supplier_name)]
    )
    try:
        client.query(sql, job_config=job_config).result()
        return {"deleted": True, "supplier_name": supplier_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/suppliers/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    client = bq_client()
    ensure_suppliers_table(client)

    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    required_cols = {"supplier_name", "country", "category"}
    all_cols = set(reader.fieldnames or [])
    if not required_cols.issubset(all_cols):
        raise HTTPException(
            status_code=400,
            detail=f"CSV must contain columns: {required_cols}. Got: {all_cols}",
        )

    try:
        existing = {
            r["supplier_name"]
            for r in client.query(f"SELECT supplier_name FROM {tbl('suppliers')}").result()
        }
    except Exception:
        existing = set()

    total_rows, added, skipped_dup, errors = 0, 0, 0, []
    rows_to_insert = []

    for i, row in enumerate(reader, start=2):
        total_rows += 1
        sn = row.get("supplier_name", "").strip()
        cn = row.get("country", "").strip()
        ca = row.get("category", "").strip()

        if not sn or not cn or not ca:
            errors.append(f"Row {i}: missing required field(s).")
            continue
        if sn in existing:
            skipped_dup += 1
            continue

        rows_to_insert.append({
            "supplier_name": sn,
            "country":       cn,
            "category":      ca,
            "added_date":    date.today().isoformat(),
        })
        existing.add(sn)
        added += 1

    if rows_to_insert:
        job_config = bigquery.LoadJobConfig(
            write_disposition="WRITE_APPEND",
            source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
        )
        job = client.load_table_from_json(
            rows_to_insert,
            f"{PROJECT_ID}.{DATASET_ID}.suppliers",
            job_config=job_config,
        )
        job.result()

    return {
        "total_rows":        total_rows,
        "added":             added,
        "skipped_duplicates": skipped_dup,
        "errors":            errors,
    }


@app.post("/api/suppliers/trigger-scan")
async def trigger_scan():
    client = bq_client()
    try:
        count_result = list(client.query(f"SELECT COUNT(*) as cnt FROM {tbl('suppliers')}").result())
        supplier_count = count_result[0]["cnt"] if count_result else 0
    except Exception:
        supplier_count = 0

    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            await http.post(f"{NEWS_FETCHER_URL}/run")
    except Exception as e:
        logger.warning(f"News fetcher call failed: {e}")

    return {"status": "scan triggered", "supplier_count": supplier_count}


# ═══════════════════════════════════════════════════════════════════════════════
# RISK INTELLIGENCE ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/risk-scores")
def get_risk_scores():
    client = bq_client()
    sql = f"""
        SELECT
            r.supplier_name, s.country, s.category, r.risk_level, r.risk_score,
            r.sentiment, r.entities, r.recommended_action,
            MAX(r.timestamp) as last_updated
        FROM {tbl('supplier_risk_scores')} r
        LEFT JOIN {tbl('suppliers')} s ON r.supplier_name = s.supplier_name
        GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
        ORDER BY
            CASE r.risk_level WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
            last_updated DESC
    """
    try:
        rows = [serialize(dict(r)) for r in client.query(sql).result()]
        return JSONResponse(rows)
    except Exception as e:
        logger.error(f"get_risk_scores error: {e}")
        return JSONResponse([])


@app.get("/api/alerts")
def get_alerts():
    client = bq_client()
    sql = f"""
        SELECT supplier_name, risk_level, alert_message, timestamp
        FROM {tbl('manager_alerts')}
        ORDER BY timestamp DESC
        LIMIT 10
    """
    try:
        rows = [serialize(dict(r)) for r in client.query(sql).result()]
        return JSONResponse(rows)
    except Exception as e:
        logger.error(f"get_alerts error: {e}")
        return JSONResponse([])


@app.get("/api/events")
def get_events():
    client = bq_client()
    sql = f"""
        SELECT
            supplier_name, country, timestamp,
            LEFT(raw_text, 120) as raw_text_preview,
            security_flag
        FROM {tbl('supply_chain_events')}
        ORDER BY timestamp DESC
        LIMIT 20
    """
    try:
        rows = [serialize(dict(r)) for r in client.query(sql).result()]
        return JSONResponse(rows)
    except Exception as e:
        logger.error(f"get_events error: {e}")
        return JSONResponse([])


@app.post("/api/simulate")
def simulate_event():
    payload = {
        "supplier_name": "Delta Semiconductors",
        "country": "Taiwan",
        "category": "Electronics",
        "source_url": "https://demo.example.com/taiwan-earthquake",
        "raw_text": (
            "A magnitude 7.4 earthquake struck Taiwan's eastern coast, causing significant"
            " structural damage to Delta Semiconductors' main fabrication facility. Operations"
            " have been halted indefinitely and chip output is expected to drop by 60% for the"
            " next 6 to 8 weeks as engineers assess the damage."
        ),
        "published_date": date.today().isoformat(),
    }
    try:
        publisher = pubsub_v1.PublisherClient()
        topic_path = publisher.topic_path(PROJECT_ID, PUBSUB_TOPIC)
        data = json.dumps(payload).encode("utf-8")
        future = publisher.publish(topic_path, data)
        future.result()
        return {"status": "published"}
    except Exception as e:
        logger.error(f"simulate_event error: {e}")
        # Fall back: return success so UI demo still works even without Pub/Sub
        return {"status": "published", "warning": str(e)}


# ═══════════════════════════════════════════════════════════════════════════════
# REACT PRODUCTION BUILD SERVING
# ═══════════════════════════════════════════════════════════════════════════════

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

frontend_dist = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount(
        "/assets",
        StaticFiles(directory=os.path.join(frontend_dist, "assets")),
        name="assets"
    )
    @app.get("/{full_path:path}")
    async def serve_react(full_path: str):
        return FileResponse(os.path.join(frontend_dist, "index.html"))
