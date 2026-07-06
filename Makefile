.PHONY: dev install build

install:
	cd risk_dashboard && uv sync
	cd risk_dashboard/frontend && npm install
	cd news_fetcher && uv sync
	cd risk_agent && uv sync

build:
	cd risk_dashboard/frontend && npm run build

dev: build
	uvicorn risk_dashboard.main:app --reload --port 8002 & \
	uvicorn news_fetcher.main:app --reload --port 8001 & \
	uvicorn risk_agent.main:app --reload --port 8003 & \
	uv run python forward_pubsub.py
