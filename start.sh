#!/bin/bash

# Define colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to kill background processes on exit
cleanup() {
    echo -e "\n${RED}[STOP] Stopping all services...${NC}"
    kill $(jobs -p) 2>/dev/null
    wait
    echo -e "${GREEN}[DONE] All services stopped.${NC}"
}

# Trap SIGINT (Ctrl+C) to run cleanup
trap cleanup SIGINT

echo -e "${GREEN}[START] Starting iMentor/Nitchiru Stack...${NC}"

# 1. Start Docker Services
if ! docker info > /dev/null 2>&1; then
    echo -e "${YELLOW}[INFO] Docker is not running. Attempting to start Docker Desktop...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open -a Docker
    else
        echo -e "${RED}[ERROR] Cannot auto-start Docker on this OS. Please start it manually.${NC}"
        exit 1
    fi

    echo -e "${YELLOW}[WAIT] Waiting for Docker to start (this make take a minute)...${NC}"
    while ! docker info > /dev/null 2>&1; do
        sleep 5
        echo -n "."
    done
    echo "" # Newline
    echo -e "${GREEN}[OK] Docker is now running.${NC}"
fi

echo -e "${YELLOW}[1/4] Starting Docker services...${NC}"
docker compose up -d
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR] Failed to start Docker services.${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] Docker services are up.${NC}"

# 2. Start Python RAG Service
echo -e "${YELLOW}[2/4] Starting Python RAG Service...${NC}"
if [ ! -d "server/rag_service/venv" ]; then
    echo -e "${RED}[ERROR] Virtual environment not found in server/rag_service/venv.${NC}"
    echo -e "${YELLOW}Please run ./install.sh first to set up environments.${NC}"
    exit 1
fi

(
    cd server/rag_service
    source venv/bin/activate
    # Run in background
    python app.py
) &
RAG_PID=$!
echo -e "${GREEN}[OK] RAG Service started (PID: $RAG_PID).${NC}"

# 3. Start Node.js Backend
echo -e "${YELLOW}[3/4] Starting Node.js Backend...${NC}"
(
    cd server
    npm start
) &
BACKEND_PID=$!
echo -e "${GREEN}[OK] Backend started (PID: $BACKEND_PID).${NC}"

# 4. Start Frontend
echo -e "${YELLOW}[4/4] Starting Frontend...${NC}"
(
    cd frontend
    npm run dev
) &
FRONTEND_PID=$!
echo -e "${GREEN}[OK] Frontend started (PID: $FRONTEND_PID).${NC}"

echo -e "\n${GREEN}All services are running!${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all services.${NC}"

# Wait for all background processes
wait
