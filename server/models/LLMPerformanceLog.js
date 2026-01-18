// server/models/LLMPerformanceLog.js
const mongoose = require('mongoose');

const LLMPerformanceLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: String, required: true, index: true },
  query: { type: String, required: true },
  response: { type: String, required: true }, // <<< ADD THIS LINE
  chosenModelId: { type: String, required: true },
  routerLogic: { type: String },
  responseTimeMs: { type: Number },
  bloomLevel: { type: String, enum: ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create', 'N/A'], default: 'N/A' },
  bloomScore: { type: Number, default: 0 }, // Numeric 1-6 representation
  userFeedback: { type: String, enum: ['positive', 'negative', 'none'], default: 'none' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('LLMPerformanceLog', LLMPerformanceLogSchema);