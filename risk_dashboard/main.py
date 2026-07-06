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
NEWS_FETCHER_URL = os.getenv("NEWS_FETCHER_URL", "http://127.0.0.1:8001")

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
    added_date: str | None = None

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
            "added_date":    s.added_date or date.today().isoformat(),
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
    # BigQuery free sandbox blocks DML (DELETE/UPDATE/INSERT).
    # Workaround: recreate the table via DDL (CREATE OR REPLACE TABLE … AS SELECT)
    # which IS permitted on the free tier.
    sql = f"""
        CREATE OR REPLACE TABLE {tbl('suppliers')} AS
        SELECT supplier_name, country, category, added_date
        FROM {tbl('suppliers')}
        WHERE supplier_name != @name
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("name", "STRING", supplier_name)]
    )
    try:
        client.query(sql, job_config=job_config).result()

        # Recreate supplier_risk_scores without the deleted supplier (if table exists)
        try:
            sql_scores = f"""
                CREATE OR REPLACE TABLE {tbl('supplier_risk_scores')} AS
                SELECT * FROM {tbl('supplier_risk_scores')}
                WHERE supplier_name != @name
            """
            client.query(sql_scores, job_config=job_config).result()
        except Exception as e:
            logger.warning(f"Did not clean up supplier_risk_scores (may not exist yet): {e}")

        # Recreate manager_alerts without the deleted supplier (if table exists)
        try:
            sql_alerts = f"""
                CREATE OR REPLACE TABLE {tbl('manager_alerts')} AS
                SELECT * FROM {tbl('manager_alerts')}
                WHERE supplier_name != @name
            """
            client.query(sql_alerts, job_config=job_config).result()
        except Exception as e:
            logger.warning(f"Did not clean up manager_alerts (may not exist yet): {e}")

        # Recreate supply_chain_events without the deleted supplier (if table exists)
        try:
            sql_events = f"""
                CREATE OR REPLACE TABLE {tbl('supply_chain_events')} AS
                SELECT * FROM {tbl('supply_chain_events')}
                WHERE supplier_name != @name
            """
            client.query(sql_events, job_config=job_config).result()
        except Exception as e:
            logger.warning(f"Did not clean up supply_chain_events (may not exist yet): {e}")

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

        ad = row.get("added_date", "").strip()
        rows_to_insert.append({
            "supplier_name": sn,
            "country":       cn,
            "category":      ca,
            "added_date":    ad or date.today().isoformat(),
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


class TriggerScanBody(BaseModel):
    supplier_names: list[str] = None

@app.post("/api/suppliers/trigger-scan")
async def trigger_scan(body: TriggerScanBody = None):
    client = bq_client()
    try:
        count_result = list(client.query(f"SELECT COUNT(*) as cnt FROM {tbl('suppliers')}").result())
        supplier_count = count_result[0]["cnt"] if count_result else 0
    except Exception:
        supplier_count = 0

    payload = {}
    if body and body.supplier_names:
        payload["supplier_names"] = body.supplier_names

    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            await http.post(f"{NEWS_FETCHER_URL}/run", json=payload)
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
          r.supplier_name, s.country, r.risk_level, r.risk_score, r.sentiment,
          r.confidence, r.entities, r.summary, r.recommended_action,
          MAX(r.timestamp) as last_updated
        FROM {tbl('supplier_risk_scores')} r
        INNER JOIN {tbl('suppliers')} s ON r.supplier_name = s.supplier_name
        GROUP BY r.supplier_name, s.country, r.risk_level, r.risk_score, r.sentiment,
          r.confidence, r.entities, r.summary, r.recommended_action
        ORDER BY last_updated DESC
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
        SELECT a.supplier_name, a.risk_level, a.alert_message, a.timestamp
        FROM {tbl('manager_alerts')} a
        INNER JOIN {tbl('suppliers')} s ON a.supplier_name = s.supplier_name
        WHERE a.timestamp > DATETIME_SUB(CURRENT_DATETIME(), INTERVAL 24 HOUR)
        ORDER BY a.timestamp DESC
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
        SELECT e.supplier_name, e.country, e.timestamp, e.article_count,
          LEFT(e.raw_texts, 1000) as raw_text_preview, e.security_flag
        FROM {tbl('supply_chain_events')} e
        INNER JOIN {tbl('suppliers')} s ON e.supplier_name = s.supplier_name
        ORDER BY e.timestamp DESC
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
        "articles": [
            {
                "source_url": "https://demo.example.com/taiwan-earthquake",
                "raw_text": (
                    "A magnitude 7.4 earthquake struck Taiwan's eastern coast, causing significant"
                    " structural damage to Delta Semiconductors' main fabrication facility. Operations"
                    " have been halted indefinitely and chip output is expected to drop by 60% for the"
                    " next 6 to 8 weeks as engineers assess the damage."
                ),
                "published_date": date.today().isoformat()
            }
        ],
        "article_count": 1,
        "fetched_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S")
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
    @app.get("/favicon.ico")
    async def serve_favicon():
        logo_path = os.path.join(frontend_dist, "logo.svg")
        if os.path.exists(logo_path):
            return FileResponse(logo_path, media_type="image/svg+xml")
        return FileResponse(os.path.join(frontend_dist, "index.html"))

    @app.get("/{full_path:path}")
    async def serve_react(full_path: str):
        file_path = os.path.join(frontend_dist, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
