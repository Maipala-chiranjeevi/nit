// src/components/BountyBoard.jsx
import React from 'react';
import { motion } from 'framer-motion';

const BountyBoard = ({ bounties, onComplete }) => {
    if (!bounties || bounties.length === 0) {
        return (
            <div className="glass-panel p-6 rounded-2xl text-center">
                <h3 className="text-xl font-bold text-text-dark mb-2">No Active Bounties</h3>
                <p className="text-text-muted-dark">Keep learning to unlock new challenges!</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold vibrant-text mb-6">Active Bounties</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {bounties.map((bounty, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="glass-card p-6 rounded-xl relative overflow-hidden group"
                    >
                        <div className={`absolute top-0 right-0 p-2 text-xs font-bold uppercase tracking-wider
              ${bounty.difficulty === 'hard' ? 'bg-red-500/20 text-red-400' :
                                bounty.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-green-500/20 text-green-400'} rounded-bl-xl`}>
                            {bounty.difficulty}
                        </div>

                        <h3 className="text-lg font-semibold text-primary-light mb-2">{bounty.topic}</h3>
                        <p className="text-sm text-text-muted-dark mb-4">{bounty.question}</p>

                        <div className="flex items-center justify-between mt-4">
                            <span className="text-accent font-bold flex items-center gap-1">
                                💎 {bounty.reward} XP
                            </span>
                            <button
                                onClick={() => onComplete(bounty)}
                                className="px-4 py-2 bg-primary/20 hover:bg-primary/40 text-primary-light rounded-lg text-sm font-medium transition-colors"
                            >
                                Claim Bounty
                            </button>
                        </div>

                        {/* Hover Effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-white/5 to-primary/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default BountyBoard;
