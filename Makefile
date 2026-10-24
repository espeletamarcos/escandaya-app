.PHONY: setup dev-backend dev-frontend test lint build

setup:
	cd backend && uv sync
	cd frontend && npm install

dev-backend:
	cd backend && uv run uvicorn backend.main:app --reload

dev-frontend:
	cd frontend && npm run dev

test:
	cd backend && uv run pytest

lint:
	cd backend && uv run ruff check .
	cd frontend && npm run lint

build:
	cd frontend && npm run build