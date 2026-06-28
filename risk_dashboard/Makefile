.PHONY: install frontend-install frontend-dev frontend-build dev build run

install:
	uv sync

frontend-install:
	cd frontend && npm install

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

dev:
	@echo "Starting FastAPI on http://localhost:8002"
	@echo "Starting React Vite on http://localhost:5173"
	uv run uvicorn main:app --reload --port 8002 & cd frontend && npm run dev

build:
	cd frontend && npm run build
	@echo "Frontend built. Starting server on http://localhost:8002"
	uv run uvicorn main:app --port 8002

run:
	uv run uvicorn main:app --reload --port 8002
