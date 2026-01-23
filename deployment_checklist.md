# Deployment Checklist for Project NIT

- [ ] Create `server/.env.example`
- [ ] Create `frontend/.env.example`
- [ ] Create `deploy_prod.sh` (Production Deployment Script)
  - [ ] System Update & Dependencies (Node, Python, Docker)
  - [ ] PM2 Installation
  - [ ] Backend Setup (Install deps, PM2 start)
  - [ ] RAG Service Setup (Venv, Install deps, PM2 start)
  - [ ] Frontend Setup (Install deps, Build, PM2 serve)
  - [ ] PM2 Startup Configuration
- [ ] Verify `docker-compose.yml` for production (restart policies, ports)
- [ ] Verify `requirements.txt` installation
- [ ] Test Deployment Script (dry run or review)
