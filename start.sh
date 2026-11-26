#!/usr/bin/env bash

# VisionCount Launch Script
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

cleanup() {
    echo ""
    echo "Stopping VisionCount services..."
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

echo "======================================================="
echo "   Starting VisionCount (Backend on :8000, UI on :3000) "
echo "======================================================="

# Start FastAPI backend using backend/.venv
if [ -f "backend/.venv/bin/python" ]; then
    PYTHON_EXEC="backend/.venv/bin/python"
else
    PYTHON_EXEC="python3"
fi

$PYTHON_EXEC -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Waiting for API server on http://localhost:8000/health..."
for i in {1..20}; do
    if curl -s http://localhost:8000/health >/dev/null 2>&1; then
        echo "✓ Backend API is ready at http://localhost:8000 (Docs: http://localhost:8000/docs)"
        break
    fi
    sleep 1
done

# Start Next.js frontend
cd frontend
npm run start &
FRONTEND_PID=$!
cd ..

echo "✓ Frontend Dashboard is running at http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services."

# Wait indefinitely
wait
