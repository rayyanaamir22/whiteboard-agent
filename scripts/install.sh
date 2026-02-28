#!/bin/bash
# install.sh for installing all dependencies 

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "📦 Installing frontend dependencies..."
cd "$PROJECT_ROOT/frontend" && npm install

echo "📦 Installing gateway-api dependencies..."
cd "$PROJECT_ROOT/services/gateway-api" && npm install

echo "✅ All dependencies installed successfully!" 