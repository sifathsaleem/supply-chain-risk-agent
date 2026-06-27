import os

from dotenv import load_dotenv

# Load local environment variables from .env
load_dotenv()

# Google Cloud Platform configuration
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("PROJECT_ID", "ringed-tuner-499715-h9")

# BigQuery Table Definitions
BIGQUERY_DATASET_NAME = os.getenv("BIGQUERY_DATASET_NAME", "supply_chain")

# Model configuration
ANALYZE_MODEL_NAME = os.getenv("ANALYZE_MODEL_NAME", "gemini-3.1-flash-lite")
ALERT_MODEL_NAME = os.getenv("ALERT_MODEL_NAME", "gemini-3.1-flash-lite")

# Risk Scoring Configuration
SCORE_NEGATIVE = 40
SCORE_NEUTRAL = 10

HIGH_SEVERITY_EVENTS = ["flood", "bankruptcy", "port_closure", "factory_fire"]
MED_SEVERITY_EVENTS = ["strike", "political_unrest", "shortage"]

SCORE_HIGH_SEVERITY = 20
SCORE_MED_SEVERITY = 10

THRESHOLD_LOW = 30
THRESHOLD_MEDIUM = 60

# Recommended Action Templates
ACTION_HIGH = "Immediately activate backup supplier and increase safety stock by 30 days."
ACTION_MEDIUM = "Monitor closely and prepare contingency plan with backup supplier."
ACTION_LOW = "Continue standard monitoring. No immediate action required."
