import asyncio
import json
import logging
import os
from datetime import date, datetime
from typing import Any

from dotenv import load_dotenv
from google.cloud import bigquery
from mcp.server.fastmcp import FastMCP

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bigquery_mcp_server")

# Read environment variables
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("PROJECT_ID", "ringed-tuner-499715-h9")
DATASET_ID = os.getenv("BIGQUERY_DATASET") or os.getenv("BIGQUERY_DATASET_NAME", "supply_chain")

# Initialize FastMCP Server
mcp = FastMCP("BigQuery MCP Server")

TABLE_SCHEMAS = {
    "supply_chain_events": [
        bigquery.SchemaField("timestamp", "DATETIME", mode="REQUIRED"),
        bigquery.SchemaField("supplier_name", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("country", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("category", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("source_urls", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("raw_texts", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("article_count", "INTEGER", mode="REQUIRED"),
        bigquery.SchemaField("security_flag", "BOOLEAN", mode="REQUIRED"),
    ],
    "supplier_risk_scores": [
        bigquery.SchemaField("timestamp", "DATETIME", mode="REQUIRED"),
        bigquery.SchemaField("supplier_name", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("risk_level", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("risk_score", "INTEGER", mode="REQUIRED"),
        bigquery.SchemaField("sentiment", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("confidence", "FLOAT", mode="REQUIRED"),
        bigquery.SchemaField("entities", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("summary", "STRING", mode="NULLABLE"),
        bigquery.SchemaField("recommended_action", "STRING", mode="REQUIRED"),
    ],
    "manager_alerts": [
        bigquery.SchemaField("timestamp", "DATETIME", mode="REQUIRED"),
        bigquery.SchemaField("supplier_name", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("risk_level", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("alert_message", "STRING", mode="REQUIRED"),
    ],
    "suppliers": [
        bigquery.SchemaField("supplier_name", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("country", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("category", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("added_date", "DATE", mode="REQUIRED"),
    ],
    "processed_urls": [
        bigquery.SchemaField("url", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("processed_at", "DATETIME", mode="REQUIRED"),
    ],
    "fetch_log": [
        bigquery.SchemaField("timestamp", "DATETIME", mode="REQUIRED"),
        bigquery.SchemaField("supplier_name", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("articles_found", "INTEGER", mode="REQUIRED"),
        bigquery.SchemaField("articles_published", "INTEGER", mode="REQUIRED"),
        bigquery.SchemaField("articles_skipped", "INTEGER", mode="REQUIRED"),
    ],
}

def ensure_dataset(client: bigquery.Client, dataset_id: str):
    """Ensures BigQuery dataset exists."""
    dataset_ref = f"{client.project}.{dataset_id}"
    try:
        client.get_dataset(dataset_ref)
    except Exception:
        dataset = bigquery.Dataset(dataset_ref)
        dataset.location = "US"
        client.create_dataset(dataset, timeout=30)
        logger.info(f"Created dataset {dataset_id}")

def ensure_table(client: bigquery.Client, dataset_id: str, table_name: str):
    """Ensures BigQuery table exists with correct schema."""
    if table_name not in TABLE_SCHEMAS:
        raise ValueError(f"Table '{table_name}' has no pre-defined schema.")

    table_ref = f"{client.project}.{dataset_id}.{table_name}"
    try:
        client.get_table(table_ref)
    except Exception:
        schema = TABLE_SCHEMAS[table_name]
        table = bigquery.Table(table_ref, schema=schema)
        client.create_table(table)
        logger.info(f"Created table {table_name}")

@mcp.tool()
async def bigquery_write(table_name: str, row: dict[str, Any]) -> dict[str, Any]:
    """Insert a row into a BigQuery table. Create the table with correct schema if missing.

    Args:
        table_name: Name of the target table.
        row: Row dictionary containing values to insert.

    Returns:
        A dict with success status and details or error messages.
    """
    try:
        client = bigquery.Client(project=PROJECT_ID)
        ensure_dataset(client, DATASET_ID)
        ensure_table(client, DATASET_ID, table_name)

        table_ref = f"{client.project}.{DATASET_ID}.{table_name}"

        # Serialize fields if needed
        serialized_row = {}
        for k, v in row.items():
            if isinstance(v, (datetime, date)):
                serialized_row[k] = v.isoformat()
            elif isinstance(v, (dict, list)):
                serialized_row[k] = json.dumps(v)
            else:
                serialized_row[k] = v

        job_config = bigquery.LoadJobConfig(
            write_disposition="WRITE_APPEND",
            source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON
        )
        job = client.load_table_from_json([serialized_row], table_ref, job_config=job_config)
        await asyncio.to_thread(job.result)
        logger.info(f"Successfully wrote row to {table_name} via load job.")
        return {"success": True, "table": table_name}
    except Exception as e:
        logger.error(f"Failed bigquery_write for {table_name}: {e}")
        return {"success": False, "error": str(e)}

@mcp.tool()
async def bigquery_merge(table_name: str, match_column: str, row: dict[str, Any]) -> dict[str, Any]:
    """Perform a MERGE (UPSERT) operation on a BigQuery table.
    
    Args:
        table_name: Name of the target table.
        match_column: Column name to match on (e.g., 'supplier_name').
        row: Row dictionary containing values to merge.
        
    Returns:
        A dict with success status and action performed.
    """
    try:
        client = bigquery.Client(project=PROJECT_ID)
        ensure_dataset(client, DATASET_ID)
        ensure_table(client, DATASET_ID, table_name)
        
        table_ref = f"{client.project}.{DATASET_ID}.{table_name}"
        
        # Serialize fields if needed
        serialized_row = {}
        for k, v in row.items():
            if isinstance(v, (datetime, date)):
                serialized_row[k] = v.isoformat()
            elif isinstance(v, (dict, list)):
                serialized_row[k] = json.dumps(v)
            else:
                serialized_row[k] = v
        
        match_val = serialized_row.get(match_column)
        if match_val is None:
            raise ValueError(f"Match column '{match_column}' value not found in row.")
            
        columns = list(serialized_row.keys())
        update_set_clause = ", ".join([f"T.{col} = S.{col}" for col in columns if col != match_column])
        insert_cols = ", ".join(columns)
        insert_vals = ", ".join([f"S.{col}" for col in columns])
        
        merge_sql = f"""
        MERGE `{table_ref}` T
        USING (
          SELECT {", ".join([f"@{col} as {col}" for col in columns])}
        ) S
        ON T.{match_column} = S.{match_column}
        WHEN MATCHED THEN
          UPDATE SET {update_set_clause}
        WHEN NOT MATCHED THEN
          INSERT ({insert_cols}) VALUES ({insert_vals})
        """
        
        query_parameters = []
        for col, val in serialized_row.items():
            if col == "timestamp":
                query_parameters.append(bigquery.ScalarQueryParameter(col, "TIMESTAMP", val))
            elif isinstance(val, bool):
                query_parameters.append(bigquery.ScalarQueryParameter(col, "BOOLEAN", val))
            elif isinstance(val, int):
                query_parameters.append(bigquery.ScalarQueryParameter(col, "INTEGER", val))
            elif isinstance(val, float):
                query_parameters.append(bigquery.ScalarQueryParameter(col, "FLOAT", val))
            else:
                query_parameters.append(bigquery.ScalarQueryParameter(col, "STRING", str(val)))
                
        job_config = bigquery.QueryJobConfig(query_parameters=query_parameters)
        
        try:
            query_job = client.query(merge_sql, job_config=job_config)
            query_job.result()
            
            action = "updated" if query_job.num_dml_affected_rows > 0 else "inserted"
            return {"success": True, "action": action}
        except Exception as dml_err:
            if "billingNotEnabled" in str(dml_err):
                logger.info(f"Billing not enabled. Using Sandbox fallback for MERGE on '{table_name}'.")
                
                select_query = f"SELECT * FROM `{table_ref}`"
                results = client.query(select_query).result()
                rows = [dict(r) for r in results]
                
                updated = False
                for r in rows:
                    if str(r.get(match_column)) == str(match_val):
                        for k, val in serialized_row.items():
                            r[k] = val
                        updated = True
                        break
                        
                if not updated:
                    rows.append(serialized_row)
                    
                for r in rows:
                    for k, val in r.items():
                        if isinstance(val, (datetime, date)):
                            r[k] = val.isoformat()
                            
                load_config = bigquery.LoadJobConfig(
                    write_disposition="WRITE_TRUNCATE",
                    source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON
                )
                load_job = client.load_table_from_json(rows, table_ref, job_config=load_config)
                load_job.result()
                return {"success": True, "action": "updated" if updated else "inserted"}
            else:
                raise dml_err
                
    except Exception as e:
        logger.error(f"Failed bigquery_merge for {table_name}: {e}")
        return {"success": False, "error": str(e)}

@mcp.tool()
async def bigquery_query(sql: str) -> dict[str, Any]:
    """Run an SQL query against BigQuery and return results as a list of dicts.

    Args:
        sql: The SQL query string to run.

    Returns:
        A dict containing 'rows' (list of dicts) and 'count' (number of rows).
    """
    try:
        client = bigquery.Client(project=PROJECT_ID)
        query_job = client.query(sql)
        results = await asyncio.to_thread(query_job.result)
        rows = [dict(row) for row in results]

        # Convert date/datetime objects to ISO string for JSON serialization
        for r in rows:
            for k, v in r.items():
                if isinstance(v, (datetime, date)):
                    r[k] = v.isoformat()

        return {"rows": rows, "count": len(rows)}
    except Exception as e:
        logger.error(f"Failed bigquery_query: {e}")
        return {"rows": [], "count": 0, "error": str(e)}

if __name__ == "__main__":
    mcp.run()
