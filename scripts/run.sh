#!/bin/bash
# run.sh for starting all services 

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🛑 Stopping existing services..."
pkill -f "nodemon.*gateway-api" 2>/dev/null || true
pkill -f "next.*dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true

echo "⏳ Waiting for processes to stop..."
sleep 2

echo "🚀 Starting Gateway API..."
cd "$PROJECT_ROOT/services/gateway-api" && npm run dev &

echo "🚀 Starting Frontend..."
cd "$PROJECT_ROOT/frontend" && npm run dev &

echo "⏳ Waiting for services to start..."
sleep 3

echo "✅ All services started!"
echo "📊 Gateway API: http://localhost:3001"
echo "🌐 Frontend: http://localhost:3000"
echo "📊 Health check: http://localhost:3001/health" 