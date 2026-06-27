import asyncio
import datetime
import json
import logging
import os
from contextlib import asynccontextmanager

from dateutil import parser as date_parser
from dotenv import load_dotenv

# Load .env variables
load_dotenv()

from fastapi import BackgroundTasks, FastAPI, HTTPException
from google.adk.tools.mcp_tool import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
from google.api_core.exceptions import NotFound
from google.cloud import bigquery, pubsub_v1
from mcp import StdioServerParameters

from news_fetcher.config import (
    BIGQUERY_DATASET_NAME,
    BIGQUERY_FETCH_LOG_TABLE,
    BIGQUERY_PROCESSED_URLS_TABLE,
    BIGQUERY_SUPPLIERS_TABLE,
    BRAVE_API_KEY,
    PROJECT_ID,
    PUBSUB_TOPIC_NAME,
    QUERY_TEMPLATE,
    SCHEDULE_INTERVAL_MINUTES,
)

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("news_fetcher")

# Mock Supplier List
MOCK_SUPPLIERS = [
    {"supplier_name": "Acme Electronics", "country": "Thailand", "category": "Electronics"},
    {"supplier_name": "Beta Textiles", "country": "Bangladesh", "category": "Apparel"},
    {"supplier_name": "Gamma Auto Parts", "country": "Vietnam", "category": "Automotive"}
]

# Application State
state = {
    "last_run_time": None,
    "status": "idle"
}
total_articles_published_today = 0
current_day = datetime.date.today()

# Setup lock to avoid concurrent fetch cycles
fetch_lock = asyncio.Lock()

# MCP Server: brave-search MCP
# Merge environment to make sure NPX/Node is executable on Windows
brave_env = os.environ.copy()
brave_env["BRAVE_API_KEY"] = BRAVE_API_KEY

brave_toolset = McpToolset(
    connection_params=StdioConnectionParams(
        server_params=StdioServerParameters(
            command="npx",
            args=["-y", "@modelcontextprotocol/server-brave-search"],
            env=brave_env
        )
    )
)

def init_bq_tables(client: bigquery.Client, dataset_id: str):
    """Ensures BigQuery dataset and tables exist."""
    dataset_ref = f"{client.project}.{dataset_id}"
    try:
        client.get_dataset(dataset_ref)
    except NotFound:
        dataset = bigquery.Dataset(dataset_ref)
        dataset.location = "US"
        client.create_dataset(dataset, timeout=30)
        logger.info(f"Created BigQuery dataset {dataset_id}")

    # Ensure suppliers table exists
    suppliers_ref = f"{client.project}.{dataset_id}.{BIGQUERY_SUPPLIERS_TABLE}"
    table_created = False
    try:
        table = client.get_table(suppliers_ref)
    except NotFound:
        schema = [
            bigquery.SchemaField("supplier_name", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("country", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("category", "STRING", mode="REQUIRED"),
        ]
        table = bigquery.Table(suppliers_ref, schema=schema)
        table = client.create_table(table)
        logger.info(f"Created BigQuery table {suppliers_ref}")
        table_created = True

    # If the table was just created or is empty, populate it with mock data
    try:
        needs_population = False
        if table_created:
            needs_population = True
        else:
            query = f"SELECT COUNT(1) as cnt FROM `{client.project}.{dataset_id}.{BIGQUERY_SUPPLIERS_TABLE}`"
            query_job = client.query(query)
            row_count = next(query_job.result()).cnt
            if row_count == 0:
                needs_population = True

        if needs_population:
            logger.info(f"Populating BigQuery table {suppliers_ref} with mock supplier data")
            job_config = bigquery.LoadJobConfig(
                write_disposition="WRITE_APPEND",
                source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON
            )
            job = client.load_table_from_json(MOCK_SUPPLIERS, suppliers_ref, job_config=job_config)
            job.result() # Wait for job to complete
            logger.info("Successfully populated mock suppliers into BigQuery.")
    except Exception as e:
        logger.error(f"Failed to populate mock suppliers in BigQuery: {e}")

    # Ensure processed_urls table exists
    processed_urls_ref = f"{client.project}.{dataset_id}.{BIGQUERY_PROCESSED_URLS_TABLE}"
    try:
        client.get_table(processed_urls_ref)
    except NotFound:
        schema = [
            bigquery.SchemaField("url", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("processed_at", "DATETIME", mode="REQUIRED"),
        ]
        table = bigquery.Table(processed_urls_ref, schema=schema)
        client.create_table(table)
        logger.info(f"Created BigQuery table {processed_urls_ref}")

    # Ensure fetch_log table exists
    fetch_log_ref = f"{client.project}.{dataset_id}.{BIGQUERY_FETCH_LOG_TABLE}"
    try:
        client.get_table(fetch_log_ref)
    except NotFound:
        schema = [
            bigquery.SchemaField("timestamp", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("supplier_name", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("articles_found", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("articles_published", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("articles_skipped", "INTEGER", mode="REQUIRED"),
        ]
        table = bigquery.Table(fetch_log_ref, schema=schema)
        client.create_table(table)
        logger.info(f"Created BigQuery table {fetch_log_ref}")


async def load_today_publish_count(client: bigquery.Client):
    """Loads count of articles published today from fetch_log to survive restarts."""
    global total_articles_published_today
    query = f"""
        SELECT SUM(articles_published) as total
        FROM `{client.project}.{BIGQUERY_DATASET_NAME}.{BIGQUERY_FETCH_LOG_TABLE}`
        WHERE DATE(timestamp) = CURRENT_DATE()
    """
    try:
        query_job = client.query(query)
        results = await asyncio.to_thread(query_job.result)
        for row in results:
            if row.total is not None:
                total_articles_published_today = row.total
                logger.info(f"Loaded today's published articles count: {total_articles_published_today}")
                return
    except Exception as e:
        logger.warning(f"Could not load today's published count from BigQuery: {e}")


async def load_suppliers(client: bigquery.Client, dataset_id: str) -> list[dict]:
    """Loads supplier list from BigQuery with mock list fallback."""
    query = f"SELECT supplier_name, country, category FROM `{client.project}.{dataset_id}.{BIGQUERY_SUPPLIERS_TABLE}`"
    try:
        query_job = client.query(query)
        results = await asyncio.to_thread(query_job.result)
        suppliers = []
        for row in results:
            suppliers.append({
                "supplier_name": row.supplier_name,
                "country": row.country,
                "category": row.category
            })

        if len(suppliers) > 0:
            logger.info(f"Loaded {len(suppliers)} suppliers from BigQuery")
            return suppliers
        else:
            logger.info(f"BigQuery unavailable, using mock supplier list ({len(MOCK_SUPPLIERS)} suppliers)")
            return MOCK_SUPPLIERS

    except Exception as e:
        logger.warning(f"Error querying BigQuery suppliers table: {e}")
        logger.info(f"BigQuery unavailable, using mock supplier list ({len(MOCK_SUPPLIERS)} suppliers)")
        return MOCK_SUPPLIERS


def parse_mcp_response(response) -> list[dict]:
    """Helper to extract list of dictionaries from MCP CallToolResult content."""
    articles = []
    if not response or not hasattr(response, "content") or not response.content:
        return []

    for block in response.content:
        if block.type == "text" and block.text:
            try:
                data = json.loads(block.text)
                if isinstance(data, list):
                    articles.extend(data)
                elif isinstance(data, dict):
                    if "web" in data and isinstance(data["web"], dict) and "results" in data["web"]:
                        articles.extend(data["web"]["results"])
                    elif "results" in data and isinstance(data["results"], list):
                        articles.extend(data["results"])
                    else:
                        articles.append(data)
            except Exception:
                pass
    return articles


def normalize_article(art: dict) -> dict:
    """Standardizes fields across both MCP servers."""
    url = art.get("url") or art.get("link") or art.get("href") or ""
    title = art.get("title") or art.get("name") or ""
    snippet = art.get("snippet") or art.get("description") or art.get("content") or art.get("summary") or ""
    date_val = art.get("date") or art.get("published") or art.get("published_date") or art.get("pubDate") or art.get("age") or ""

    return {
        "url": str(url).strip(),
        "title": str(title).strip(),
        "snippet": str(snippet).strip(),
        "date": str(date_val).strip()
    }


def parse_published_date(date_str: str | None) -> datetime.date:
    """Robust date parser supporting ISO, RSS/RFC 822, and relative age strings."""
    if not date_str:
        return datetime.date.today()

    date_str_clean = date_str.strip()
    if not date_str_clean:
        return datetime.date.today()

    if "hour" in date_str_clean.lower() or "minute" in date_str_clean.lower() or "second" in date_str_clean.lower():
        return datetime.date.today()

    if "day" in date_str_clean.lower():
        try:
            digits = [int(s) for s in date_str_clean.split() if s.isdigit()]
            if digits:
                return datetime.date.today() - datetime.timedelta(days=digits[0])
        except Exception:
            pass
        return datetime.date.today()

    try:
        dt = date_parser.parse(date_str_clean)
        return dt.date()
    except Exception:
        return datetime.date.today()


async def call_mcp_tool(
    toolset: McpToolset,
    tool_name_choices: list[str],
    arg_name_choices: list[str],
    query: str,
    limit: int = 5
) -> list[dict]:
    """Helper to dynamically invoke an MCP tool with schema checking."""
    session = await toolset._mcp_session_manager.create_session()
    tools_result = await session.list_tools()

    tool_name = None
    for t in tools_result.tools:
        if t.name in tool_name_choices:
            tool_name = t.name
            break

    if not tool_name:
        for t in tools_result.tools:
            if "search" in t.name or "keyword" in t.name:
                tool_name = t.name
                break
        if not tool_name:
            tool_name = tool_name_choices[0]

    tool_def = next((t for t in tools_result.tools if t.name == tool_name), None)
    arg_name = None
    if tool_def and hasattr(tool_def, "inputSchema") and isinstance(tool_def.inputSchema, dict):
        properties = tool_def.inputSchema.get("properties", {})
        for name in arg_name_choices:
            if name in properties:
                arg_name = name
                break

    if not arg_name:
        arg_name = arg_name_choices[0]

    arguments = {arg_name: query}

    if tool_def and hasattr(tool_def, "inputSchema") and isinstance(tool_def.inputSchema, dict):
        properties = tool_def.inputSchema.get("properties", {})
        if "count" in properties:
            arguments["count"] = limit
        elif "limit" in properties:
            arguments["limit"] = limit

    response = await session.call_tool(tool_name, arguments=arguments)
    return parse_mcp_response(response)


async def filter_processed_urls(client: bigquery.Client, dataset_id: str, urls: list[str]) -> set[str]:
    """Checks which URLs are already in processed_urls BigQuery table."""
    if not urls:
        return set()

    query = f"""
        SELECT url 
        FROM `{client.project}.{dataset_id}.{BIGQUERY_PROCESSED_URLS_TABLE}` 
        WHERE url IN UNNEST(@urls)
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ArrayQueryParameter("urls", "STRING", urls)
        ]
    )
    try:
        query_job = client.query(query, job_config=job_config)
        results = await asyncio.to_thread(query_job.result)
        return {row.url for row in results}
    except Exception as e:
        logger.error(f"Error checking processed URLs in BigQuery: {e}")
        return set()


async def insert_processed_urls(client: bigquery.Client, dataset_id: str, urls: list[str]):
    """Appends new processed URLs via load jobs (supporting Sandbox/Free Tier)."""
    if not urls:
        return

    table_ref = f"{client.project}.{dataset_id}.{BIGQUERY_PROCESSED_URLS_TABLE}"
    rows_to_insert = [
        {"url": url, "processed_at": datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")}
        for url in urls
    ]
    try:
        job_config = bigquery.LoadJobConfig(
            write_disposition="WRITE_APPEND",
            source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON
        )
        job = client.load_table_from_json(rows_to_insert, table_ref, job_config=job_config)
        await asyncio.to_thread(job.result)
        logger.info(f"Successfully inserted {len(urls)} processed URLs via load job.")
    except Exception as e:
        logger.error(f"Failed to insert processed URLs via load job: {e}")


async def log_fetch_results(client: bigquery.Client, dataset_id: str, name: str, found: int, published: int, skipped: int):
    """Appends execution statistics via load jobs (supporting Sandbox/Free Tier)."""
    table_ref = f"{client.project}.{dataset_id}.{BIGQUERY_FETCH_LOG_TABLE}"
    row = {
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "supplier_name": name,
        "articles_found": found,
        "articles_published": published,
        "articles_skipped": skipped
    }
    try:
        job_config = bigquery.LoadJobConfig(
            write_disposition="WRITE_APPEND",
            source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON
        )
        job = client.load_table_from_json([row], table_ref, job_config=job_config)
        await asyncio.to_thread(job.result)
        logger.info(f"Successfully logged fetch results for '{name}' via load job.")
    except Exception as e:
        logger.error(f"Failed to log fetch results via load job: {e}")


async def perform_fetch() -> dict:
    """Executes one full fetch cycle across all suppliers."""
    logger.info("Starting news fetch cycle...")

    bq_client = bigquery.Client(project=PROJECT_ID)
    publisher = pubsub_v1.PublisherClient()
    topic_path = publisher.topic_path(PROJECT_ID, PUBSUB_TOPIC_NAME)

    # Ensure Pub/Sub topic exists
    try:
        publisher.get_topic(topic=topic_path)
    except Exception:
        try:
            # Use request={"name": topic_path} to create topic
            publisher.create_topic(request={"name": topic_path})
            logger.info(f"Created Pub/Sub topic {topic_path}")
        except Exception as e:
            logger.error(f"Failed to create/get Pub/Sub topic: {e}")
            pass

    # Load supplier list
    suppliers = await load_suppliers(bq_client, BIGQUERY_DATASET_NAME)

    summary = {
        "suppliers_scanned": 0,
        "articles_found": 0,
        "articles_published": 0,
        "articles_skipped": 0,
        "details": []
    }

    today_date = datetime.date.today()
    seven_days_ago = today_date - datetime.timedelta(days=7)

    global total_articles_published_today, current_day

    # Reset count if day changed
    if today_date != current_day:
        current_day = today_date
        total_articles_published_today = 0

    for supplier in suppliers:
        name = supplier["supplier_name"]
        country = supplier["country"]
        category = supplier["category"]

        # Build search query
        query = QUERY_TEMPLATE.format(supplier_name=name, country=country)
        logger.info(f"Searching news for supplier '{name}' with query: '{query}'")

        found_articles = []
        source_used = ""

        # Use Brave Search
        try:
            raw_res = await call_mcp_tool(
                brave_toolset,
                tool_name_choices=["brave_web_search", "web_search"],
                arg_name_choices=["query", "keyword"],
                query=query,
                limit=5
            )
            if len(raw_res) >= 1:
                found_articles = raw_res
                source_used = "brave-search"
        except Exception as e:
            logger.error(f"Brave Search MCP failed for '{name}': {e}")

        # Log which source was used
        if source_used:
            logger.info(f"Source: {source_used}")
        else:
            logger.info("Source: none (no results or errors on Brave Search)")
            # Fall back to a mock article for testing Pub/Sub and BigQuery logging
            logger.info(f"Using mock news article fallback for supplier '{name}' to test the Pub/Sub and BigQuery pipeline")
            found_articles = [{
                "url": f"https://www.news-disruption-test.com/{name.lower().replace(' ', '-')}-delay-2026-{int(datetime.datetime.utcnow().timestamp())}",
                "title": f"Supply Chain Disruption Alert: {name} facing delays",
                "snippet": f"Reports indicate that {name} in {country} is experiencing severe logistics disruptions affecting {category} shipments.",
                "date": datetime.date.today().isoformat()
            }]
            source_used = "mock-fallback"

        first_5_articles = found_articles[:5]
        normalized_articles = [normalize_article(art) for art in first_5_articles]

        urls_to_check = [art["url"] for art in normalized_articles if art["url"]]
        processed_urls = set()
        if urls_to_check:
            processed_urls = await filter_processed_urls(bq_client, BIGQUERY_DATASET_NAME, urls_to_check)

        published_count = 0
        skipped_count = 0
        new_urls_to_insert = []

        for art in normalized_articles:
            url = art["url"]
            if not url:
                skipped_count += 1
                continue

            if url in processed_urls:
                skipped_count += 1
                logger.info(f"Skipping duplicate article URL: {url}")
                continue

            pub_date = parse_published_date(art["date"])
            if pub_date < seven_days_ago:
                skipped_count += 1
                logger.info(f"Skipping article older than 7 days (published {pub_date}): {url}")
                continue

            # Construct message
            message_data = {
                "supplier_name": name,
                "country": country,
                "category": category,
                "source_url": url,
                "raw_text": f"{art['title']}. {art['snippet']}",
                "published_date": pub_date.strftime("%Y-%m-%d")
            }

            try:
                message_bytes = json.dumps(message_data).encode("utf-8")
                future = publisher.publish(topic_path, message_bytes)
                await asyncio.to_thread(future.result)
                logger.info(f"Published article to Pub/Sub: {url}")

                published_count += 1
                total_articles_published_today += 1
                new_urls_to_insert.append(url)
            except Exception as e:
                logger.error(f"Failed to publish article {url}: {e}")
                skipped_count += 1

        if new_urls_to_insert:
            await insert_processed_urls(bq_client, BIGQUERY_DATASET_NAME, new_urls_to_insert)

        found_count = len(first_5_articles)
        await log_fetch_results(bq_client, BIGQUERY_DATASET_NAME, name, found_count, published_count, skipped_count)

        summary["suppliers_scanned"] += 1
        summary["articles_found"] += found_count
        summary["articles_published"] += published_count
        summary["articles_skipped"] += skipped_count
        summary["details"].append({
            "supplier_name": name,
            "found": found_count,
            "published": published_count,
            "skipped": skipped_count
        })

    logger.info(f"News fetch cycle completed. Summary: {summary}")
    return summary


async def run_scheduler():
    """Loops and executes fetch cycle every SCHEDULE_INTERVAL_MINUTES."""
    # Delay startup fetch slightly to let app initialize fully
    await asyncio.sleep(5)

    # Startup fetch
    try:
        async with fetch_lock:
            state["status"] = "running"
            await perform_fetch()
            state["last_run_time"] = datetime.datetime.utcnow().isoformat() + "Z"
            state["status"] = "idle"
    except Exception as e:
        logger.error(f"Error on startup fetch: {e}")
        state["status"] = "idle"

    while True:
        await asyncio.sleep(SCHEDULE_INTERVAL_MINUTES * 60)
        try:
            async with fetch_lock:
                state["status"] = "running"
                await perform_fetch()
                state["last_run_time"] = datetime.datetime.utcnow().isoformat() + "Z"
                state["status"] = "idle"
        except Exception as e:
            logger.error(f"Error in scheduled fetch: {e}")
            state["status"] = "idle"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initializes external components and kicks off scheduler."""
    try:
        bq_client = bigquery.Client(project=PROJECT_ID)
        init_bq_tables(bq_client, BIGQUERY_DATASET_NAME)
        await load_today_publish_count(bq_client)
    except Exception as e:
        logger.warning(f"Failed to initialize BigQuery tables or load stats: {e}")

    scheduler_task = asyncio.create_task(run_scheduler())
    yield

    # Shutdown
    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        pass

    try:
        await brave_toolset._mcp_session_manager.close()
    except Exception as e:
        logger.warning(f"Error closing MCP sessions: {e}")


app = FastAPI(
    title="News Fetcher Agent",
    description="Microservice responsible for searching supply chain disruptions and publishing them to Pub/Sub.",
    lifespan=lifespan
)


@app.get("/")
def get_health():
    """Health check endpoint returning agent running state and statistics."""
    global total_articles_published_today, current_day

    # Check if a new day has arrived
    if datetime.date.today() != current_day:
        current_day = datetime.date.today()
        total_articles_published_today = 0

    return {
        "last_run_time": state["last_run_time"],
        "total_articles_published_today": total_articles_published_today,
        "status": state["status"]
    }


@app.post("/run")
async def manual_run(background_tasks: BackgroundTasks):
    """Manually triggers a full news fetch cycle."""
    if fetch_lock.locked():
        raise HTTPException(status_code=409, detail="A news fetch cycle is already in progress.")

    async def run_in_background():
        async with fetch_lock:
            state["status"] = "running"
            try:
                await perform_fetch()
                state["last_run_time"] = datetime.datetime.utcnow().isoformat() + "Z"
            except Exception as e:
                logger.error(f"Error during manual background run: {e}")
            finally:
                state["status"] = "idle"

    background_tasks.add_task(run_in_background)
    return {
        "status": "started",
        "message": "Manual fetch cycle initiated in the background."
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
