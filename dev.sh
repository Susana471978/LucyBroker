#!/bin/bash

echo "🚀 Iniciando entorno EmailSystem Control..."

# Colores
GREEN="\e[32m"
BLUE="\e[34m"
RED="\e[31m"
RESET="\e[0m"

# Rutas
ROOT="$HOME/repos/EmailSystem-control"
DB_PATH="/var/lib/mongodb"

# Terminal check
if ! command -v mongod &> /dev/null; then
  echo -e "${RED}❌ MongoDB no está instalado${RESET}"
  exit 1
fi

# Mongo
echo -e "${BLUE}▶ Iniciando MongoDB...${RESET}"
mongod --dbpath "$DB_PATH" --bind_ip 127.0.0.1 > mongo.log 2>&1 &

sleep 3

# Backend
echo -e "${BLUE}▶ Iniciando Backend...${RESET}"
cd "$ROOT" || exit

source .venv/bin/activate

PYTHONPATH=. uvicorn backend.main:app --reload --port 8000 > backend.log 2>&1 &

sleep 2

# Frontend
if [ -d "frontend" ]; then
  echo -e "${BLUE}▶ Iniciando Frontend...${RESET}"
  cd frontend || exit
  npm start > frontend.log 2>&1 &
else
  echo -e "${RED}⚠️ Frontend no encontrado, omitido${RESET}"
fi

echo -e "${GREEN}✅ Entorno levantado${RESET}"
echo "Mongo → mongo.log"
echo "Backend → backend.log"
echo "Frontend → frontend.log"
