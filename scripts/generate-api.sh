#!/bin/bash
# Generate OpenAPI TypeScript client from FastAPI schema

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "Generating OpenAPI client..."

API_URL="${VOICEBOX_API_URL:-http://127.0.0.1:17493}"
OPENAPI_URL="${API_URL%/}/openapi.json"
VENV_PYTHON="backend/.venv/bin/python"

if [ ! -x "$VENV_PYTHON" ]; then
    echo "Error: backend/.venv not found. Run: bun run setup:python"
    exit 1
fi

if ! command -v uv >/dev/null 2>&1; then
    echo "Error: uv is required. Install from https://docs.astral.sh/uv/getting-started/installation/"
    exit 1
fi

# Check if backend is already running
if ! curl -sf "$OPENAPI_URL" > /dev/null 2>&1; then
    echo "Backend not running at $API_URL. Starting temporary backend on 127.0.0.1:18000..."
    cd "$PROJECT_ROOT/backend"

    uv run --python "$PWD/.venv/bin/python" -m uvicorn main:app --port 18000 &
    BACKEND_PID=$!

    API_URL="http://127.0.0.1:18000"
    OPENAPI_URL="${API_URL}/openapi.json"

    echo "Waiting for server to start..."
    for i in {1..30}; do
        if curl -sf "$OPENAPI_URL" > /dev/null 2>&1; then
            break
        fi
        sleep 1
    done

    if ! curl -sf "$OPENAPI_URL" > /dev/null 2>&1; then
        echo "Error: Backend failed to start"
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi

    echo "Backend started (PID: $BACKEND_PID)"
    STARTED_BACKEND=true
else
    STARTED_BACKEND=false
fi

# Download OpenAPI schema
echo "Downloading OpenAPI schema..."
cd "$PROJECT_ROOT"
curl -sf "$OPENAPI_URL" > app/openapi.json

# Check if openapi-typescript-codegen is installed
if ! bunx --bun openapi-typescript-codegen --version > /dev/null 2>&1; then
    echo "Installing openapi-typescript-codegen..."
    bun add -d openapi-typescript-codegen
fi

# Generate TypeScript client
echo "Generating TypeScript client..."
cd app
bunx --bun openapi-typescript-codegen \
    --input openapi.json \
    --output src/lib/api \
    --client fetch \
    --useOptions \
    --exportSchemas true

echo "API client generated in app/src/lib/api"

# Clean up
if [ "$STARTED_BACKEND" = true ]; then
    echo "Stopping backend server..."
    kill $BACKEND_PID 2>/dev/null || true
fi

echo "Done!"
