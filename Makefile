.PHONY: dev install build

install:
	cd risk_dashboard && uv sync
	cd risk_dashboard/frontend && npm install
	cd news_fetcher && uv sync
	cd risk_agent && uv sync

build:
	cd risk_dashboard/frontend && npm run build

dev: build
	uv run uvicorn risk_dashboard.main:app --reload --host 127.0.0.1 --port 8002 & \
	uv run uvicorn news_fetcher.main:app --reload --host 127.0.0.1 --port 8001 & \
	uv run uvicorn risk_agent.fast_api_app:app --reload --host 127.0.0.1 --port 8000 & \
	uv run python forward_pubsub.py

