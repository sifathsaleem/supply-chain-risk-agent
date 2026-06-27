.PHONY: install playground test run

install:
	uv sync

playground:
	uv run agents-cli playground --port 8080

test:
	uv run pytest tests/test_scoring.py

run:
	uv run uvicorn app.fast_api_app:app --host 0.0.0.0 --port 8080
