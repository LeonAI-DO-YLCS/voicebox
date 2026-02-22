#!/bin/bash
# Build Python server binary for all platforms

set -e

# Determine platform
PLATFORM=$(rustc --print host-tuple 2>/dev/null || echo "unknown")
VENV_PYTHON="backend/.venv/bin/python"

echo "Building voicebox-server for platform: $PLATFORM"

if ! command -v uv >/dev/null 2>&1; then
    echo "Error: uv is required. Install from https://docs.astral.sh/uv/getting-started/installation/"
    exit 1
fi

if [ ! -x "$VENV_PYTHON" ]; then
    echo "Error: backend/.venv is missing. Run: bun run setup:python"
    exit 1
fi

# Build Python binary
cd backend || exit 1

# Check if PyInstaller is installed
if ! "$PWD/.venv/bin/python" -c "import PyInstaller" 2>/dev/null; then
    echo "Installing PyInstaller..."
    uv pip install --python "$PWD/.venv/bin/python" pyinstaller
fi

# Build binary
"$PWD/.venv/bin/python" build_binary.py

# Create binaries directory if it doesn't exist
mkdir -p ../tauri/src-tauri/binaries

# Copy binary with platform suffix
if [ -f dist/voicebox-server ]; then
    cp dist/voicebox-server ../tauri/src-tauri/binaries/voicebox-server-${PLATFORM}
    chmod +x ../tauri/src-tauri/binaries/voicebox-server-${PLATFORM}
    echo "Built voicebox-server-${PLATFORM}"
elif [ -f dist/voicebox-server.exe ]; then
    cp dist/voicebox-server.exe ../tauri/src-tauri/binaries/voicebox-server-${PLATFORM}.exe
    echo "Built voicebox-server-${PLATFORM}.exe"
else
    echo "Error: Binary not found in dist/"
    exit 1
fi

echo "Build complete!"
