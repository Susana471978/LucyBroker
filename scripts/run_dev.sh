#!/bin/bash
# Script de desarrollo — arranca backend y frontend en paralelo

export ENV=development

echo "🚀 Arrancando backend (FastAPI)..."
VENV_PYTHON="/home/susana/repos/EmailSystem-control/.venv/bin/python"
if [ -x "$VENV_PYTHON" ]; then
    "$VENV_PYTHON" -m uvicorn backend.server:app --host 0.0.0.0 --port 8000 --reload &
else
    uvicorn backend.server:app --host 0.0.0.0 --port 8000 --reload &
fi

BACKEND_PID=$!
echo "✅ Backend PID: $BACKEND_PID"

echo "🚀 Arrancando frontend (Vite)..."
cd frontend && npm run dev &
FRONTEND_PID=$!
echo "✅ Frontend PID: $FRONTEND_PID"

echo ""
echo "Backend  → http://localhost:8000"
echo "Frontend → http://localhost:3000"
echo ""
echo "Ctrl+C para detener ambos procesos"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
