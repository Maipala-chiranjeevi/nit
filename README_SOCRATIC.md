# Socratic Tutor Integration Guide

This branch contains the files necessary to integrate the Socratic Tutor feature into the NIT project.

## 1. Backend Integration

### 1.1 Requirements
Ensure you have the following python services running if `server/socratic_service` relies on them (e.g., Neo4j, ChromaDB, standard RAG service).
Install any node dependencies if missing (e.g. `multer`, `axios`).

### 1.2 Route Setup
In your `server/server.js`, verify or add:

```javascript
const socraticRoutes = require("./routes/socratic");

// Mount the route
app.use("/api/socratic", socraticRoutes);
```

### 1.3 New Files Added
- `server/routes/socratic.js`: Main route logic.
- `server/models/SocraticSession.js`: Mongoose model.
- `server/socratic_service/`: Python/Backend logic directory.
- `server/utils/logger.js`: Logging utility (ensure this doesn't conflict with existing).

## 2. Frontend Integration

### 2.1 Route Setup
In `frontend/src/App.jsx` (or your router config):

```jsx
import SocraticModePage from './components/tools/SocraticModePage.jsx';
import StudyPlanPage from './components/learning/StudyPlanPage.jsx';

// Add Routes
<Route path="/tools/socratic-mode" element={<SocraticModePage />} />
<Route path="/study-plan" element={<StudyPlanPage />} />
```

### 2.2 API Service
A dedicated API file `frontend/src/services/socratic_api.js` has been provided. You can either use it directly or merge its methods into your main `api.js`.

## 3. Usage
Navigate to `/tools/socratic-mode` to start a session.
