# Voicebox Makefile
# Unix-only (macOS/Linux). Windows users should use WSL.

SHELL := /bin/bash
.DEFAULT_GOAL := help

# Directories
BACKEND_DIR := backend
TAURI_DIR := tauri
WEB_DIR := web
APP_DIR := app

# Python (prefer 3.12, fallback to 3.11, then python3)
PYTHON := $(shell command -v python3.12 2>/dev/null || command -v python3.11 2>/dev/null || echo python3)
UV := $(shell command -v uv 2>/dev/null || echo uv)
VENV := $(CURDIR)/$(BACKEND_DIR)/.venv
VENV_BIN := $(VENV)/bin
PYTHON_VENV := $(VENV_BIN)/python

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m # No Color

.PHONY: help
help: ## Show this help message
	@echo -e "$(BLUE)Voicebox$(NC) - Development Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'

# =============================================================================
# SETUP
# =============================================================================

.PHONY: setup setup-js setup-python setup-rust

setup: setup-js setup-python ## Full project setup (all dependencies)
	@echo -e "$(GREEN)✓ Setup complete!$(NC)"
	@echo -e "  Run $(YELLOW)make dev$(NC) to start development servers"

setup-js: ## Install JavaScript dependencies (bun)
	@echo -e "$(BLUE)Installing JavaScript dependencies...$(NC)"
	bun install

setup-python: ## Set up Python virtual environment and dependencies with uv
	@echo -e "$(BLUE)Installing Python dependencies...$(NC)"
	@command -v $(UV) >/dev/null 2>&1 || (echo -e "$(YELLOW)uv is required. Install from https://docs.astral.sh/uv/getting-started/installation/$(NC)" && exit 1)
	@if [ "$${UV_VENV_CLEAR:-0}" = "1" ]; then \
		echo -e "$(BLUE)Recreating $(VENV) with uv --clear...$(NC)"; \
		$(UV) venv --clear --python $(PYTHON) $(VENV); \
	elif [ -x "$(PYTHON_VENV)" ]; then \
		echo -e "$(BLUE)Reusing existing $(VENV)$(NC)"; \
	else \
		echo -e "$(BLUE)Creating $(VENV) with uv...$(NC)"; \
		$(UV) venv --python $(PYTHON) $(VENV); \
	fi
	$(UV) pip install --python $(PYTHON_VENV) -r $(BACKEND_DIR)/requirements.txt
	@if [ "$$(uname -m)" = "arm64" ] && [ "$$(uname)" = "Darwin" ]; then \
		echo -e "$(BLUE)Detected Apple Silicon - installing MLX dependencies...$(NC)"; \
		$(UV) pip install --python $(PYTHON_VENV) -r $(BACKEND_DIR)/requirements-mlx.txt; \
		echo -e "$(GREEN)✓ MLX backend enabled (native Metal acceleration)$(NC)"; \
	fi
	$(UV) pip install --python $(PYTHON_VENV) git+https://github.com/QwenLM/Qwen3-TTS.git
	@echo -e "$(GREEN)✓ Python environment ready$(NC)"

setup-rust: ## Install Rust toolchain (if not present)
	@command -v rustc >/dev/null 2>&1 || curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# =============================================================================
# DEVELOPMENT
# =============================================================================

.PHONY: dev dev-backend dev-frontend dev-web kill-dev

dev: ## Start backend + desktop app (parallel)
	@echo -e "$(BLUE)Starting development servers...$(NC)"
	@echo -e "$(YELLOW)Note: If Tauri fails, run 'make build-server' first or use separate terminals$(NC)"
	@trap 'kill 0' EXIT; \
		$(MAKE) dev-backend & \
		sleep 2 && $(MAKE) dev-frontend & \
		wait

dev-backend: ## Start FastAPI backend server
	@echo -e "$(BLUE)Starting backend server (auto port fallback)$(NC)"
	bun run dev:server

dev-frontend: ## Start Tauri desktop app
	@echo -e "$(BLUE)Starting Tauri desktop app...$(NC)"
	bun run dev

dev-web: ## Start backend + web app (parallel)
	@echo -e "$(BLUE)Starting web development servers...$(NC)"
	@trap 'kill 0' EXIT; \
		$(MAKE) dev-backend & \
		sleep 2 && cd $(WEB_DIR) && bun run dev & \
		wait

kill-dev: ## Kill all development processes
	@echo -e "$(YELLOW)Killing development processes...$(NC)"
	-pkill -f "uvicorn backend.main:app" 2>/dev/null || true
	-pkill -f "backend.main --data-dir" 2>/dev/null || true
	-pkill -f "vite" 2>/dev/null || true
	@echo -e "$(GREEN)✓ Processes killed$(NC)"

# =============================================================================
# BUILD
# =============================================================================

.PHONY: build build-server build-tauri build-web

build: build-server build-tauri ## Build everything (server binary + desktop app)
	@echo -e "$(GREEN)✓ Build complete!$(NC)"

build-server: ## Build Python server binary
	@echo -e "$(BLUE)Building server binary...$(NC)"
	PATH="$(VENV_BIN):$$PATH" ./scripts/build-server.sh

build-tauri: ## Build Tauri desktop app
	@echo -e "$(BLUE)Building Tauri desktop app...$(NC)"
	cd $(TAURI_DIR) && bun run tauri build

build-web: ## Build web app
	@echo -e "$(BLUE)Building web app...$(NC)"
	cd $(WEB_DIR) && bun run build
	@echo -e "$(GREEN)✓ Web build output in $(WEB_DIR)/dist/$(NC)"

# =============================================================================
# DATABASE & API
# =============================================================================

.PHONY: db-init db-reset generate-api

db-init: ## Initialize SQLite database
	@echo -e "$(BLUE)Initializing database...$(NC)"
	@if [ ! -x "$(PYTHON_VENV)" ]; then echo -e "$(YELLOW)Python env missing. Run: make setup-python$(NC)"; exit 1; fi
	cd $(BACKEND_DIR) && $(PYTHON_VENV) -c "from database import init_db; init_db()"
	@echo -e "$(GREEN)✓ Database created at $(BACKEND_DIR)/data/voicebox.db$(NC)"

db-reset: ## Reset database (delete and reinitialize)
	@echo -e "$(YELLOW)Resetting database...$(NC)"
	rm -f $(BACKEND_DIR)/data/voicebox.db
	$(MAKE) db-init

generate-api: ## Generate TypeScript API client from OpenAPI schema
	@echo -e "$(BLUE)Generating API client...$(NC)"
	@echo -e "$(YELLOW)Note: Backend must be running (make dev-backend)$(NC)"
	./scripts/generate-api.sh
	@echo -e "$(GREEN)✓ API client generated in $(APP_DIR)/src/lib/api/$(NC)"

# =============================================================================
# CODE QUALITY
# =============================================================================

.PHONY: lint format typecheck check

lint: ## Run linter (Biome)
	@echo -e "$(BLUE)Linting...$(NC)"
	bun run lint

format: ## Format code (Biome)
	@echo -e "$(BLUE)Formatting...$(NC)"
	bun run format

typecheck: ## Run TypeScript type checking
	@echo -e "$(BLUE)Type checking...$(NC)"
	bun run tsc --noEmit

check: ## Run all checks (Biome lint + format + type check)
	@echo -e "$(BLUE)Running all checks...$(NC)"
	bun run check
	@echo -e "$(GREEN)✓ All checks passed$(NC)"

# =============================================================================
# TESTING
# =============================================================================

.PHONY: test test-backend test-frontend

test: test-backend test-frontend ## Run all tests
	@echo -e "$(GREEN)✓ All tests passed$(NC)"

test-backend: ## Run Python backend tests (requires pytest)
	@echo -e "$(BLUE)Running backend tests...$(NC)"
	@if [ -f "$(PYTHON_VENV)" ]; then \
		cd $(BACKEND_DIR) && $(PYTHON_VENV) -m pytest -v; \
	else \
		echo -e "$(YELLOW)Python env missing. Run: make setup-python$(NC)"; \
		exit 1; \
	fi

test-frontend: ## Run frontend tests (requires test script in package.json)
	@echo -e "$(BLUE)Running frontend tests...$(NC)"
	@if bun run test --help >/dev/null 2>&1; then \
		bun run test; \
	else \
		echo -e "$(YELLOW)No test script configured$(NC)"; \
		exit 1; \
	fi

# =============================================================================
# LOGS & DEBUGGING
# =============================================================================

.PHONY: logs docs

logs: ## Tail backend logs
	@echo -e "$(BLUE)Tailing logs (Ctrl+C to stop)...$(NC)"
	tail -f $(BACKEND_DIR)/logs/*.log 2>/dev/null || echo "No log files found"

docs: ## Open API documentation (backend must be running)
	@echo -e "$(BLUE)Opening API docs...$(NC)"
	open http://localhost:17493/docs 2>/dev/null || xdg-open http://localhost:17493/docs

# =============================================================================
# CLEAN
# =============================================================================

.PHONY: clean clean-python clean-build clean-all

clean: ## Clean build artifacts
	@echo -e "$(BLUE)Cleaning build artifacts...$(NC)"
	rm -rf $(TAURI_DIR)/src-tauri/target/release
	rm -rf $(WEB_DIR)/dist
	rm -rf $(APP_DIR)/dist
	@echo -e "$(GREEN)✓ Build artifacts cleaned$(NC)"

clean-python: ## Clean Python cache and virtual environment
	@echo -e "$(BLUE)Cleaning Python files...$(NC)"
	rm -rf $(VENV)
	find $(BACKEND_DIR) -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find $(BACKEND_DIR) -type f -name "*.pyc" -delete 2>/dev/null || true
	@echo -e "$(GREEN)✓ Python environment cleaned$(NC)"

clean-build: ## Clean Rust/Tauri build cache
	@echo -e "$(BLUE)Cleaning Rust build cache...$(NC)"
	cd $(TAURI_DIR)/src-tauri && cargo clean
	@echo -e "$(GREEN)✓ Rust cache cleaned$(NC)"

clean-all: clean clean-python clean-build ## Nuclear clean (everything)
	@echo -e "$(BLUE)Cleaning node_modules...$(NC)"
	rm -rf node_modules
	rm -rf $(APP_DIR)/node_modules
	rm -rf $(TAURI_DIR)/node_modules
	rm -rf $(WEB_DIR)/node_modules
	@echo -e "$(GREEN)✓ Full clean complete$(NC)"
