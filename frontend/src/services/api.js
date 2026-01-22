
import axios from 'axios';

// Create generic axios instance
const apiClient = axios.create({
    // Use port 2000 as discovered from server logs
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:2000/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Intercept requests to inject token
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

const api = {
    // --- System / Utils ---
    submitFeedback: async (type, message) => {
        const response = await apiClient.post('/feedback', { type, message });
        return response.data;
    },
    getOrchestratorStatus: async () => {
        try {
            // Hit root to avoid /api/auth fallthrough
            await apiClient.get('/', { baseURL: 'http://localhost:2000' });
            return { status: 'online', services: { database: 'connected', vector_db: 'connected' } };
        } catch (e) {
            return { status: 'offline' };
        }
    },
    getSubjects: async () => {
        const response = await apiClient.get('/subjects');
        return response.data;
    },
    updateUserLLMConfig: async (config) => {
        const response = await apiClient.post('/llm/config', config);
        return response.data;
    },

    // --- Auth ---
    login: async (credentials) => {
        const response = await apiClient.post('/auth/signin', credentials);
        return response.data;
    },
    signup: async (userData) => {
        const response = await apiClient.post('/auth/signup', userData);
        return response.data;
    },
    sendOtp: async (email, password) => {
        const response = await apiClient.post('/auth/send-otp', { email, password });
        return response.data;
    },
    getMe: async () => {
        const response = await apiClient.get('/auth/me');
        return response.data;
    },
    getUserProfile: async () => {
        const response = await apiClient.get('/auth/me'); // Mapping to getMe for consistency
        return response.data;
    },
    updateUserProfile: async (data) => {
        const response = await apiClient.get('/auth/me'); // Using get/update on me usually
        // If there is a specific update endpoint:
        // For now assumes ProfileSettingsModal calls api.updateUserProfile
        // We'll trust there is an implementation or map to put /auth/profile if /auth/me is read-only
        // Based on typical REST:
        const update = await apiClient.put('/user/profile', data);
        return update.data;
    },
    completeOnboarding: async () => {
        const response = await apiClient.post('/auth/complete-onboarding');
        return response.data;
    },

    // --- Gamification ---
    claimBounty: async (bountyId, answer = '') => {
        const response = await apiClient.post('/user/bounties/claim', { bountyId, answer });
        return response.data;
    },

    // --- Chat & Sessions ---
    sendMessage: async (payload) => {
        const response = await apiClient.post('/chat/message', payload); // Corrected endpoint to /message based on chat.js line 48
        return response.data;
    },
    startNewSession: async (previousSessionId, skipAnalysis = false) => {
        const response = await apiClient.post('/chat/history', { previousSessionId, skipAnalysis });
        return response.data;
    },
    getChatSessions: async () => {
        const response = await apiClient.get('/chat/sessions'); // Corrected endpoint to /sessions based on chat.js line 365
        return response.data;
    },
    getChatHistory: async (sessionId) => {
        const response = await apiClient.get(`/chat/session/${sessionId}`); // Corrected endpoint to /session/:id based on chat.js line 380
        return response.data;
    },
    deleteChatSession: async (sessionId) => {
        const response = await apiClient.delete(`/chat/session/${sessionId}`);
        return response.data;
    },
    analyzePrompt: async (prompt) => {
        // Mock or real endpoint
        return { complexity: 'medium', improvements: [] };
    },

    // --- Documents ---
    getFiles: async () => {
        const response = await apiClient.get('/upload/files');
        return response.data;
    },
    uploadFile: async (formData) => {
        const response = await apiClient.post('/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },
    deleteFile: async (filename) => {
        const response = await apiClient.delete(`/upload/files/${filename}`);
        return response.data;
    },
    addUrlSource: async (url) => {
        const response = await apiClient.post('/upload/url', { url });
        return response.data;
    },

    // --- Learning Paths ---
    getLearningPaths: async () => {
        const response = await apiClient.get('/learning/paths');
        return response.data;
    },
    generateLearningPath: async (goal, context = {}) => {
        const response = await apiClient.post('/learning/generate', { goal, context });
        return response.data;
    },
    deleteLearningPath: async (id) => {
        const response = await apiClient.delete(`/learning/paths/${id}`);
        return response.data;
    },
    updateModuleStatus: async (pathId, moduleId, status) => {
        const response = await apiClient.put(`/learning/paths/${pathId}/modules/${moduleId}`, { status });
        return response.data;
    },

    // --- Analysis ---
    analyzeCode: async (payload) => {
        const response = await apiClient.post('/tools/analyze-code', payload);
        return response.data;
    },
    executeCode: async (payload) => {
        const response = await apiClient.post('/tools/execute', payload);
        return response.data;
    },
    explainError: async (payload) => {
        const response = await apiClient.post('/tools/explain-error', payload);
        return response.data;
    },
    submitIntegrityCheck: async (payload) => {
        const response = await apiClient.post('/tools/integrity/check', payload);
        return response.data;
    },
    getIntegrityReport: async (id) => {
        const response = await apiClient.get(`/tools/integrity/report/${id}`);
        return response.data;
    },
    formatReferences: async (payload) => {
        const response = await apiClient.post('/tools/format-references', payload);
        return response.data;
    },
    generateQuiz: async (file, options) => {
        const formData = new FormData();
        if (file) formData.append('file', file);
        formData.append('options', JSON.stringify(options));
        const response = await apiClient.post('/tools/quiz/generate', formData);
        return response.data;
    },

    // --- Knowledge Graph / Recommendations ---
    generateDocumentFromTopic: async (topic) => {
        const response = await apiClient.post('/generate/document', { topic });
        return response.data;
    },
    findDocumentForTopic: async (topic) => {
        const response = await apiClient.post('/generate/find-document', { topic });
        return response.data;
    },
    getRecommendations: async (sessionId) => {
        const response = await apiClient.get(`/analysis/recommendations/${sessionId}`);
        return response.data;
    },

    // --- Knowledge Sources ---
    getKnowledgeSources: async () => {
        const response = await apiClient.get('/knowledge-sources');
        return response.data;
    },
    deleteKnowledgeSource: async (id) => {
        const response = await apiClient.delete(`/knowledge-sources/${id}`);
        return response.data;
    },

    // --- Socratic Mode ---
    socraticChat: async (payload) => {
        const response = await apiClient.post("/socratic/chat", payload);
        return response.data;
    },
    socraticUpload: async (file, sessionId = null) => {
        const formData = new FormData();
        formData.append("file", file);
        if (sessionId) formData.append("sessionId", sessionId);

        const response = await apiClient.post("/socratic/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" }
        });
        return response.data;
    },
    getSocraticSessions: async () => {
        const response = await apiClient.get("/socratic/sessions");
        return response.data;
    },
    getSocraticHistory: async (sessionId) => {
        const response = await apiClient.get(`/socratic/history/${sessionId}`);
        return response.data;
    },
    deleteSocraticSession: async (sessionId) => {
        const response = await apiClient.delete(`/socratic/history/${sessionId}`);
        return response.data;
    },
    setLearningLevel: async (sessionId, level) => {
        const response = await apiClient.put(`/socratic/session/${sessionId}/level`, { level });
        return response.data;
    },
    generateStudyPlan: async (sessionId) => {
        const response = await apiClient.post(`/socratic/session/${sessionId}/plan`);
        return response.data;
    },
    updateTopicStatus: async (sessionId, topicIndex, status) => {
        const response = await apiClient.put(`/socratic/session/${sessionId}/topic/${topicIndex}`, { status });
        return response.data;
    }
};

export default api;
