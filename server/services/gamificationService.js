// server/services/gamificationService.js
const User = require('../models/User');
const geminiService = require('./geminiService');

const BLOOM_LEVELS = {
    'Remember': 1,
    'Understand': 2,
    'Apply': 3,
    'Analyze': 4,
    'Evaluate': 5,
    'Create': 6,
    'N/A': 0
};

const CLASSIFICATION_PROMPT = `You are an expert pedagogical analyst. Classify the following student query based on Bloom's Taxonomy.
Possible levels: 'Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'.
If the query is conversational (e.g., "Hello", "Thanks"), irrelevant, or unclear, classify as 'N/A'.

Query: "{query}"

Return only the level name as a string.`;

/**
 * Classifies a user query into a Bloom's Taxonomy level.
 * @param {string} query 
 * @returns {Promise<string>}
 */
async function classifyQuery(query) {
    try {
        const prompt = CLASSIFICATION_PROMPT.replace('{query}', query);
        // Use generateContentWithHistory with empty history for single prompt
        const result = await geminiService.generateContentWithHistory([], prompt);
        // Expecting single word response
        const level = result.trim().replace(/['"]/g, '');
        if (BLOOM_LEVELS.hasOwnProperty(level)) {
            return level;
        }
        return 'N/A';
    } catch (error) {
        console.error("Error classifying query for Bloom's Taxonomy:", error);
        return 'N/A';
    }
}

/**
 * Awards learning credits to a user.
 * @param {string} userId 
 * @param {number} amount 
 */
async function awardCredits(userId, amount) {
    try {
        await User.findByIdAndUpdate(userId, { $inc: { 'profile.learningCredits': amount } });
    } catch (error) {
        console.error("Error awarding credits:", error);
    }
}

/**
 * Updates the user's Bloom Score average.
 * @param {string} userId 
 * @param {string} bloomLevel 
 */
async function updateBloomScore(userId, bloomLevel) {
    if (bloomLevel === 'N/A') return;

    const score = BLOOM_LEVELS[bloomLevel];
    try {
        const user = await User.findById(userId);
        if (!user) return;

        // Moving average calculation (simplistic approach for now)
        // Ideally, we'd query all logs, but for performance, we can approximate or just increment a total.
        // Let's implement a weighted update to keep it simple: NewAvg = OldAvg + (NewScore - OldAvg) / N
        // Since we don't track N efficiently in User model yet (only in logs), let's just add to a 'cumulativeBloomScore' if we wanted exactness.
        // For now, let's just update the *latest* score or a running average if we had count.
        // Let's stick to a simple strategy: fetch recent logs count? No, too expensive.
        // Revised strategy: Just update the field for now, maybe recalculate periodically?
        // Or better: Let's simple store the last level for immediate feedback, and use aggregation for "Average Score" when viewing profile.

        // Actually, let's just increment a total and count if we want an average, but the schema has 'bloomScore'.
        // Let's treat 'bloomScore' as the *current* level estimate or a simple point accumulator.
        // Let's go with: Points accumulator logic for "Score" (Gamification context).
        // Higher level = More points.

        const points = score * 10; // 10, 20, ... 60 points
        user.profile.bloomScore = (user.profile.bloomScore || 0) + points;
        await user.save();

    } catch (error) {
        console.error("Error updating Bloom Score:", error);
    }
}

module.exports = {
    BLOOM_LEVELS,
    classifyQuery,
    awardCredits,
    updateBloomScore
};
