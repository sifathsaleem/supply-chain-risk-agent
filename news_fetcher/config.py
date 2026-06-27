import os

from dotenv import load_dotenv

# Load local environment variables from .env
load_dotenv()

# Google Cloud Platform configuration
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("PROJECT_ID", "ringed-tuner-499715-h9")

# BigQuery Table Definitions
BIGQUERY_DATASET_NAME = os.getenv("BIGQUERY_DATASET_NAME", "supply_chain")
BIGQUERY_SUPPLIERS_TABLE = os.getenv("BIGQUERY_SUPPLIERS_TABLE", "suppliers")
BIGQUERY_PROCESSED_URLS_TABLE = os.getenv("BIGQUERY_PROCESSED_URLS_TABLE", "processed_urls")
BIGQUERY_FETCH_LOG_TABLE = os.getenv("BIGQUERY_FETCH_LOG_TABLE", "fetch_log")

# Pub/Sub Configuration
PUBSUB_TOPIC_NAME = os.getenv("PUBSUB_TOPIC_NAME", "supply-chain-news")

# Search and Interval Configuration
SCHEDULE_INTERVAL_MINUTES = int(os.getenv("SCHEDULE_INTERVAL_MINUTES", "30"))
QUERY_TEMPLATE = os.getenv(
    "QUERY_TEMPLATE",
    "{supplier_name} {country} supply chain disruption OR strike OR flood OR bankruptcy OR port closure 2026"
)

# Third-party APIs (never hardcoded)
BRAVE_API_KEY = os.getenv("BRAVE_API_KEY", "")
