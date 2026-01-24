const mongoose = require('mongoose');

const SocraticSessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    fileHashes: [{
        type: String,
        required: true
    }],
    filenames: [{
        type: String,
        required: true
    }],
    messages: [{
        role: { type: String, enum: ['user', 'assistant'], required: true },
        content: { type: String, required: true },
        timestamp: { type: Date, default: Date.now }
    }],
    studyPlan: [{
        topic: { type: String, required: true },
        description: { type: String },
        status: {
            type: String,
            enum: ['pending', 'in-progress', 'completed'],
            default: 'pending'
        },
        order: { type: Number },
        subtopics: [{
            topic: { type: String, required: true },
            description: { type: String },
            status: {
                type: String,
                enum: ['pending', 'in-progress', 'completed'],
                default: 'pending'
            },
            order: { type: Number }
        }]
    }],
    learningLevel: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
        default: 'beginner'
    },
    currentTopicIndex: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('SocraticSession', SocraticSessionSchema);
