#!/bin/bash
export ENV=development
VENV_PYTHON="/home/susana/repos/EmailSystem-control/.venv/bin/python"
if [ -x "$VENV_PYTHON" ]; then
	"$VENV_PYTHON" -m uvicorn backend.server:app --host 0.0.0.0 --port 8000 --reload
else
	uvicorn backend.server:app --host 0.0.0.0 --port 8000 --reload
fi
