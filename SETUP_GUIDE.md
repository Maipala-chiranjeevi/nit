# User-Friendly Setup Guide for iMentor/Nitchiru

Welcome! This guide will help you set up and run the iMentor/Nitchiru application on your machine. This project is a complex system involving a React frontend, Node.js backend, Python RAG service, and several Dockerized databases.

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed.

> **Note for macOS/Linux Users:** The provided `install.sh` script can automate most of these installations for you.

*   **Operating System**: macOS or Linux (Ubuntu/Debian recommended). Windows users should use WSL2.
*   **Docker Desktop**: Required for databases (Neo4j, Qdrant, Redis, ElasticSearch). [Download Here](https://www.docker.com/products/docker-desktop/)
*   **Node.js**: Version 18.x or higher.
*   **Python**: Version 3.10.

---

## 🚀 Quick Setup (Recommended)

The easiest way to get started is using the automated installation script.

### 1. Clone the Repository
```bash
git clone https://github.com/tej-a192/chatbot-Team-2.git
cd chatbot-Team-2
```
*(If you are already in the project folder, skip this step)*

### 2. Run the Installer
This script will install dependencies, create virtual environments, and set up your `.env` configuration files.

```bash
# You may need sudo for system dependencies
sudo bash install.sh
```

**What this does:**
- Installs Node.js & Python system packages.
- Sets up the Python Virtual Environment (`venv`) for the AI service.
- Installs `npm` packages for Frontend and Server.
- Creates `server/.env` and `frontend/.env` with placeholders.
- Seeds the database with initial AI models.

---

## ⚙️ Configuration

**Critical Step**: The installer created `.env` files, but they have placeholder values. You **MUST** update them for the app to work.

### 1. Backend Configuration (`server/.env`)
Open `server/.env` and update the following:

- **JWT_SECRET**: Generate a random string (e.g., just mash your keyboard or use `openssl rand -base64 32`).
- **ENCRYPTION_SECRET**: Needs to be a 64-character hex string. Run this command to generate one:
  ```bash
  openssl rand -hex 32
  ```
- **GEMINI_API_KEY**: Your Google Gemini API Key. (Get one from [Google AI Studio](https://aistudio.google.com/)).
- **SENTRY_DSN** (Optional): Error tracking URL. Leave blank if you don't use Sentry.
- **AWS Credentials** (Optional): Required only if you want to use S3 for dataset storage.

### 2. Frontend Configuration (`frontend/.env`)
Usually, the defaults here are fine (`VITE_API_BASE_URL=http://localhost:2000/api`). Double-check it matches your server port.

---

## ▶️ Running the Application

You have two options to start the app: the **All-in-One Script** or the **Manual Method**.

### Option A: The "Magic" Script (Easiest)
We have a script that launches everything for you.

```bash
./start.sh
```
*Wait for a minute.* This will:
1. Start Docker containers.
2. Launch the Python RAG service.
3. Start the Node.js Backend.
4. Start the Frontend.

The app should automatically open, or you can visit: **http://localhost:2173**

### Option B: Manual Startup (For Debugging)
If the script fails, or you want to see logs for each service, run them in separate terminal windows:

**Terminal 1: Docker Services**
```bash
docker compose up -d
```

**Terminal 2: Python RAG Service**
```bash
cd server/rag_service
source venv/bin/activate  # Activate Python environment
python app.py
```

**Terminal 3: Node.js Backend**
```bash
cd server
npm start
```

**Terminal 4: Frontend**
```bash
cd frontend
npm run dev
```

---

## 🛠️ Troubleshooting

### Common Issues

1.  **"Port already in use"**
    -   Make sure no other instances of the app are running.
    -   Check if you have other services on ports `2000`, `2001`, or `2173`.
    -   Use `lsof -i :<port>` to identify the process and `kill <PID>` to stop it.

2.  **"Docker is not running"**
    -   Open Docker Desktop and ensure the engine is started before running commands.

3.  **"Module not found" (Python)**
    -   Ensure you activated the virtual environment (`source server/rag_service/venv/bin/activate`) before running `pip install` or `python app.py`.

4.  **"Connection refused" (Database)**
    -   Wait a minute after `docker compose up`. Services like ElasticSearch take a while to initialize.

---

## 📚 Accessing Specific Tools
-   **Main App**: [http://localhost:2173](http://localhost:2173)
-   **Kibana Logs**: [http://localhost:2007](http://localhost:2007)
-   **Grafana Metrics**: [http://localhost:2009](http://localhost:2009)
-   **Neo4j Browser**: [http://localhost:2004](http://localhost:2004) (Auth: `neo4j` / `password`)

Happy Coding! 🚀
