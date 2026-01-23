#!/bin/bash
set -e

# ==============================================================================
# NIT Production Deployment Script
# ==============================================================================

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Starting Production Deployment for Project NIT...${NC}"

# Check for sudo
if [ "$(id -u)" -ne 0 ]; then
    echo -e "${RED}Please run as root (sudo).${NC}"
    exit 1
fi

# 1. System Updates & Dependencies
echo -e "${YELLOW}[1/7] Updating System & Installing Dependencies...${NC}"
apt-get update

# Install general dependencies
echo -e "${YELLOW}Installing Base Dependencies (curl, git, ffmpeg, tesseract, python)...${NC}"
apt-get install -y curl git build-essential python3.10 python3.10-venv python3-pip tesseract-ocr ffmpeg gnupg software-properties-common

# Install MongoDB (Host Service)
if ! command -v mongod &> /dev/null; then
    echo -e "${YELLOW}Installing MongoDB...${NC}"
    curl -fsSL https://pgp.mongodb.com/server-6.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-6.0.gpg
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list
    apt-get update
    apt-get install -y mongodb-org
    systemctl start mongod
    systemctl enable mongod
else
    echo -e "${GREEN}MongoDB is already installed.${NC}"
fi

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Installing Docker...${NC}"
    curl -fsSL https://get.docker.com | sh
    systemctl start docker
    systemctl enable docker
fi

# Install Node.js 18 if not present
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Installing Node.js 18...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

# Install PM2 globally
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}Installing PM2...${NC}"
    npm install -g pm2
fi

# 2. Project Setup
echo -e "${YELLOW}[2/7] Setting up Project Configuration...${NC}"

# Check/Create .env files
if [ ! -f server/.env ]; then
    echo -e "${YELLOW}Creating server/.env from example...${NC}"
    if [ -f server/.env.example ]; then
        cp server/.env.example server/.env
        echo -e "${RED}IMPORTANT: Please update server/.env with real credentials!${NC}"
    else
        echo -e "${RED}server/.env.example not found! Skipping creation.${NC}"
    fi
fi

if [ ! -f frontend/.env ]; then
    echo -e "${YELLOW}Creating frontend/.env from example...${NC}"
    if [ -f frontend/.env.example ]; then
        cp frontend/.env.example frontend/.env
    fi
fi

# 3. Backend Dependencies
echo -e "${YELLOW}[3/7] Installing Backend Dependencies...${NC}"
cd server
npm install
cd ..

# 4. RAG Service Dependencies
echo -e "${YELLOW}[4/7] Installing RAG Service Dependencies...${NC}"
if [ ! -d "server/rag_service/venv" ]; then
    echo -e "${YELLOW}Creating Python venv...${NC}"
    python3.10 -m venv server/rag_service/venv
fi

echo -e "${YELLOW}Installing Python requirements (this may take a while)...${NC}"
# Install in venv
./server/rag_service/venv/bin/pip install --upgrade pip
./server/rag_service/venv/bin/pip install -r server/rag_service/requirements.txt
./server/rag_service/venv/bin/python -m spacy download en_core_web_sm

# 5. Frontend Build
echo -e "${YELLOW}[5/7] Building Frontend...${NC}"
cd frontend
npm install
npm run build
cd ..

# 6. Start Auxiliary Services & Seed DB
echo -e "${YELLOW}[6/7] Starting Auxiliary Services & Seeding DB...${NC}"

# Start Docker containers
echo -e "${YELLOW}Starting Docker Containers...${NC}"
docker compose up -d

# Wait a moment for Mongo/Docker to be ready
echo -e "${YELLOW}Waiting for services to warm up...${NC}"
sleep 10

# Seed Database
echo -e "${YELLOW}Seeding Database...${NC}"
cd server
node scripts/seedLLMs.js || echo -e "${RED}Warning: Seeding LLMs failed. Make sure Mongo is running.${NC}"
# Optional: Seed Admin if needed
# node seedAdmin.js || echo -e "${RED}Warning: Seeding Admin failed.${NC}"
cd ..

# 7. Start App Services
echo -e "${YELLOW}[7/7] Starting App Services with PM2...${NC}"

# Stop existing PM2 processes to ensure clean restart
pm2 delete all || true

# Start Node Backend
echo -e "${YELLOW}Starting Backend...${NC}"
if [ -f server/server.js ]; then
    pm2 start server/server.js --name "nit-backend"
else
    pm2 start server/index.js --name "nit-backend"
fi

# Start RAG Service
echo -e "${YELLOW}Starting RAG Service...${NC}"
pm2 start server/rag_service/app.py --interpreter ./server/rag_service/venv/bin/python --name "nit-rag"

# Serve Frontend
echo -e "${YELLOW}Serving Frontend...${NC}"
pm2 serve frontend/dist 5173 --name "nit-frontend" --spa

# Save PM2 list
pm2 save

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}   Deployment Complete!                  ${NC}"
echo -e "${GREEN}=========================================${NC}"
echo -e "Frontend: http://localhost:5173 (or Server IP:5173)"
echo -e "Backend:  http://localhost:2000"
echo -e "${YELLOW}To make PM2 start on boot, run: 'pm2 startup' and follow instructions.${NC}"
