const express = require('express');
const router = express.Router();
const LLMPerformanceLog = require('../models/LLMPerformanceLog');
const Feedback = require('../models/Feedback');

// @route   POST /api/feedback
// @desc    Submit general platform feedback (Bug, Feature, etc.)
// @access  Private
router.post('/', async (req, res) => {
    try {
        const { type, message } = req.body;

        if (!message) {
            return res.status(400).json({ message: 'Feedback message is required' });
        }

        const newFeedback = new Feedback({
            user: req.user._id,
            type: type || 'general',
            message
        });

        await newFeedback.save();
        res.status(201).json({ message: 'Feedback submitted successfully' });
    } catch (error) {
        console.error('Error submitting feedback:', error);
        res.status(500).json({ message: 'Server error submitting feedback' });
    }
});

// @route   GET /api/feedback
// @desc    Get all platform feedback (Admin only)
// @access  Private (Admin check needed, but strict admin middleware might be applied at route level in server.js? 
//          Actually existing route is just authMiddleware. We should check admin here or trust the frontend/use admin middleware if mounted differently.
//          The existing server.js mounts it as app.use('/api/feedback', feedbackRoutes); which has NO admin restriction, only authMiddleware from lines 96-97. 
//          So we must check for admin inside this route for security.)
router.get('/', async (req, res) => {
    try {
        if (!req.user.isAdmin) {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const feedbacks = await Feedback.find()
            .populate('user', 'username email')
            .sort({ createdAt: -1 });

        res.json(feedbacks);
    } catch (error) {
        console.error('Error fetching feedback:', error);
        res.status(500).json({ message: 'Server error fetching feedback' });
    }
});

// @route   POST /api/feedback/:logId
// @desc    Submit user feedback for a specific AI response
// @access  Private (authMiddleware is applied in server.js)
router.post('/:logId', async (req, res) => {
    const { logId } = req.params;
    const { feedback } = req.body; // 'positive' or 'negative'
    const userId = req.user._id;

    if (!['positive', 'negative'].includes(feedback)) {
        return res.status(400).json({ message: 'Invalid feedback value.' });
    }

    try {
        const logEntry = await LLMPerformanceLog.findById(logId);

        // Security check: Ensure the log belongs to the user submitting feedback
        if (!logEntry || logEntry.userId.toString() !== userId.toString()) {
            return res.status(404).json({ message: 'Log entry not found or access denied.' });
        }

        logEntry.userFeedback = feedback;
        await logEntry.save();

        res.status(200).json({ message: 'Thank you for your feedback!' });
    } catch (error) {
        console.error(`Error saving feedback for log ${logId}:`, error);
        res.status(500).json({ message: 'Server error while saving feedback.' });
    }
});

module.exports = router;