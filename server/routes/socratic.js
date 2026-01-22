const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const SocraticSession = require('../models/SocraticSession');
const { logger } = require('../utils/logger'); // Assuming you have a logger

// Multer Setup for File Uploads
const upload = multer({ dest: 'uploads/' });

const SOCRATIC_SERVICE_URL = process.env.SOCRATIC_SERVICE_URL || 'http://127.0.0.1:2002';

// --- Helper Functions ---
function calculateFileHash(filepath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filepath);
        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

// --- Routes ---

// 1. Upload File & Create/Update Session
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const userId = req.user?._id;
        const sessionId = req.body.sessionId; // Optional: Append to existing session
        const filepath = req.file.path;
        const filename = req.file.originalname;

        // 1. Hash File
        const fileHash = await calculateFileHash(filepath);

        // 2. Send to Python Service for Ingestion
        // We send the file file to the python service.
        // It's often easier to send the FILE itself again or move it.
        // BUT, for simple RAG, sending the path might work if local, but usually we re-upload.
        // Let's assume we re-upload or send the file stream.

        // Use form-data library for Node.js
        const FormData = require('form-data');
        const pyFormData = new FormData();
        pyFormData.append('file', fs.createReadStream(filepath), filename);
        pyFormData.append('file_hash', fileHash);

        const pyRes = await axios.post(`${SOCRATIC_SERVICE_URL}/ingest`, pyFormData, {
            headers: {
                ...pyFormData.getHeaders()
            }
        });

        const { cached, summary } = pyRes.data;

        // 3. Update or Create MongoDB Session
        let session;
        if (sessionId) {
            session = await SocraticSession.findOne({ _id: sessionId, userId });
        }

        if (!session) {
            session = new SocraticSession({
                userId,
                fileHashes: [],
                filenames: [],
                messages: []
            });
        }

        // Add file info if not already present
        if (!session.fileHashes.includes(fileHash)) {
            session.fileHashes.push(fileHash);
            session.filenames.push(filename);
        }

        // Add System/Assistant Message about the file
        const systemMsg = `I've analyzed **${filename}**. ${summary ? `\n\n**Summary:**\n${summary}` : ''}`;
        session.messages.push({ role: 'assistant', content: systemMsg });

        await session.save();

        // Cleanup temp file
        fs.unlinkSync(filepath);

        res.json({
            message: "File processed",
            sessionId: session._id,
            cached: cached,
            summary: summary
        });

    } catch (error) {
        logger.error(`Socratic Upload Error: ${error.message}`);
        res.status(500).json({ message: "Upload failed", error: error.message });
    }
});

// 2. Chat with Socratic Tutor
router.post('/chat', async (req, res) => {
    const { message, sessionId } = req.body;
    const userId = req.user?._id;

    if (!message || !sessionId) return res.status(400).json({ message: "Missing fields" });

    try {
        const session = await SocraticSession.findOne({ _id: sessionId, userId });
        if (!session) return res.status(404).json({ message: "Session not found" });

        // Save User Message
        session.messages.push({ role: 'user', content: message });
        await session.save();

        // Call Python (Prepare history)
        const historyForPy = session.messages.map(m => ({ role: m.role, content: m.content }));

        // Prepare context
        const currentTopic = session.studyPlan && session.studyPlan.length > 0 && session.currentTopicIndex >= 0 && session.currentTopicIndex < session.studyPlan.length
            ? session.studyPlan[session.currentTopicIndex]
            : null;

        const pyRes = await axios.post(`${SOCRATIC_SERVICE_URL}/chat`, {
            query: message,
            file_hashes: session.fileHashes,
            history: historyForPy,
            current_topic: currentTopic ? currentTopic.topic : null,
            learning_level: session.learningLevel
        });

        const assistantResponse = pyRes.data.response;
        const isTopicCompleted = pyRes.data.topic_completed;

        // Save Assistant Message
        session.messages.push({ role: 'assistant', content: assistantResponse });

        // Handle Automatic Topic Completion
        if (isTopicCompleted && currentTopic && currentTopic.status !== 'completed') {
            const currentIndex = session.currentTopicIndex;

            // Mark current as complete
            session.studyPlan[currentIndex].status = 'completed';

            // Find next topic
            const nextIndex = currentIndex + 1;
            if (nextIndex < session.studyPlan.length) {
                session.studyPlan[nextIndex].status = 'in-progress';
                session.currentTopicIndex = nextIndex;

                // Add System Message for Transition
                session.messages.push({
                    role: 'assistant',
                    content: `🎉 **Topic Completed!**\n\nYou've demonstrated a good understanding of **${currentTopic.topic}**.\nLet's move on to the next topic: **${session.studyPlan[nextIndex].topic}**.`
                });
            } else {
                // All done
                session.messages.push({
                    role: 'assistant',
                    content: `🏆 **Congratulations!**\n\nYou have completed the entire study plan for this document!`
                });
            }
        }

        await session.save();

        res.json({ response: assistantResponse, topic_completed: isTopicCompleted });

    } catch (error) {
        logger.error(`Chat Error: ${error.message}`);
        const status = error.response?.status || 500;
        const msg = error.response?.data?.error || error.message;
        res.status(status).json({ message: msg });
    }
});

// 3. Get All Sessions
router.get('/sessions', async (req, res) => {
    const userId = req.user?._id;
    try {
        const sessions = await SocraticSession.find({ userId }).sort({ updatedAt: -1 }).select('filenames createdAt updatedAt');
        // Map to a friendlier format if needed, or send as is
        const formatted = sessions.map(s => ({
            _id: s._id,
            filename: s.filenames.join(', ') || "Untitled Session", // Display string
            filenames: s.filenames,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt
        }));
        res.json(formatted);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch sessions" });
    }
});

// 4. Get Session History
router.get('/history/:sessionId', async (req, res) => {
    const userId = req.user?._id;
    try {
        const session = await SocraticSession.findOne({ _id: req.params.sessionId, userId });
        if (!session) return res.status(404).json({ message: "Session not found" });
        res.json(session);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch history" });
    }
});

// 5. Delete Session
router.delete('/history/:sessionId', async (req, res) => {
    const userId = req.user?._id;
    try {
        await SocraticSession.deleteOne({ _id: req.params.sessionId, userId });
        res.json({ message: "Session deleted" });
    } catch (error) {
        res.status(500).json({ message: "Failed to delete session" });
    }
});

// 6. Set Learning Level
router.put('/session/:sessionId/level', async (req, res) => {
    const userId = req.user?._id;
    const { level } = req.body;

    if (!['beginner', 'intermediate', 'advanced'].includes(level)) {
        return res.status(400).json({ message: "Invalid level" });
    }

    try {
        const session = await SocraticSession.findOneAndUpdate(
            { _id: req.params.sessionId, userId },
            { learningLevel: level },
            { new: true }
        );
        res.json(session);
    } catch (error) {
        res.status(500).json({ message: "Failed to update level" });
    }
});

// 7. Generate Study Plan
router.post('/session/:sessionId/plan', async (req, res) => {
    const userId = req.user?._id;
    try {
        const session = await SocraticSession.findOne({ _id: req.params.sessionId, userId });
        if (!session) return res.status(404).json({ message: "Session not found" });

        const pyRes = await axios.post(`${SOCRATIC_SERVICE_URL}/generate_plan`, {
            file_hashes: session.fileHashes,
            learning_level: session.learningLevel
        });

        const planData = pyRes.data;

        session.studyPlan = planData.study_plan.map(item => ({
            ...item,
            status: 'pending' // Default status
        }));

        // Auto-start first topic
        if (session.studyPlan.length > 0) {
            session.studyPlan[0].status = 'in-progress';
            session.currentTopicIndex = 0;

            // Add notification message
            session.messages.push({
                role: 'assistant',
                content: `**Study Plan Generated!** 📚\n\nI've created a study plan based on your documents. We'll start with: **${session.studyPlan[0].topic}**.\n\n${session.studyPlan[0].description}`
            });
        }

        await session.save();
        res.json(session);

    } catch (error) {
        logger.error(`Plan Gen Error: ${error.message}`);
        const msg = error.response?.data?.error || "Failed to generate plan";
        res.status(500).json({ message: msg });
    }
});

// 8. Update Topic Status
router.put('/session/:sessionId/topic/:topicIndex', async (req, res) => {
    const userId = req.user?._id;
    const topicIndex = parseInt(req.params.topicIndex);
    const { status } = req.body;

    try {
        const session = await SocraticSession.findOne({ _id: req.params.sessionId, userId });
        if (!session) return res.status(404).json({ message: "Session not found" });

        if (!session.studyPlan || !session.studyPlan[topicIndex]) {
            return res.status(400).json({ message: "Invalid topic index" });
        }

        session.studyPlan[topicIndex].status = status;

        // Logic check: If completed, maybe suggest moving to next?
        if (status === 'completed') {
            // Find next pending or future topic
            const nextIndex = topicIndex + 1;
            if (nextIndex < session.studyPlan.length) {
                if (session.studyPlan[nextIndex].status === 'pending') {
                    session.studyPlan[nextIndex].status = 'in-progress';
                    session.currentTopicIndex = nextIndex;

                    session.messages.push({
                        role: 'assistant',
                        content: `Great job completing **${session.studyPlan[topicIndex].topic}**! 🎉\n\nLet's move on to: **${session.studyPlan[nextIndex].topic}**.`
                    });
                }
            } else {
                session.messages.push({
                    role: 'assistant',
                    content: `Congratulations! You've completed the entire study plan! 🎓`
                });
            }
        } else if (status === 'in-progress') {
            session.currentTopicIndex = topicIndex;
        }

        await session.save();
        res.json(session);

    } catch (error) {
        res.status(500).json({ message: "Failed to update topic" });
    }
});

module.exports = router;
