// src/pages/ProfilePage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import FeedbackModal from '../components/profile/FeedbackModal';
import Button from '../components/core/Button';
import SkillTree from '../components/SkillTree';
import BountyBoard from '../components/BountyBoard';
import ActivityHeatmap from '../components/ActivityHeatmap';
import { motion } from 'framer-motion';
import { User, Trophy, Star, Target, Brain, Award, MessageSquarePlus } from 'lucide-react';

const ProfilePage = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [bounties, setBounties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const profileData = await api.getUserProfile();

                // Calculate level based on credits (e.g., 1000 credits = Level 1)
                const credits = profileData.profile?.learningCredits || 0;
                const bloomScore = profileData.profile?.bloomScore || 0;

                let rank = "Novice"; // Logic to determine rank could be added here
                if (credits > 5000) rank = "Scholar";
                if (credits > 10000) rank = "Master";

                setStats({
                    credits: credits,
                    bloomScore: bloomScore.toFixed(1),
                    rank: rank,
                    streak: 0 // Streak logic not yet implemented in backend
                });

                setBounties(profileData.profile?.activeBounties || []);

            } catch (error) {
                console.error("Failed to fetch profile data", error);
                // Fallback to zeros if fail, or show error state
                setStats({ credits: 0, bloomScore: 0, rank: 'Novice', streak: 0 });
            } finally {
                setLoading(false);
            }
        };

        if (user) fetchData();
    }, [user]);

    const handleClaimBounty = async (bounty) => {
        try {
            const result = await api.claimBounty(bounty._id);
            setStats(prev => ({ ...prev, credits: result.credits }));
            // Remove the completed bounty from the list locally
            setBounties(prev => prev.filter(b => b._id !== bounty._id));
            // Or fetch profile again to refresh everything
        } catch (error) {
            console.error("Failed to claim bounty:", error);
            // Optionally show toast error
        }
    };

    if (loading) return <div className="p-10 text-center">Loading Profile...</div>;

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark p-4 md:p-8 space-y-8 overflow-y-auto custom-scrollbar">

            {/* Header Section */}
            <header className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-center gap-6 relative">
                <div className="absolute top-4 right-4">
                    <Button
                        size="sm"
                        onClick={() => setIsFeedbackOpen(true)}
                        leftIcon={<MessageSquarePlus size={18} />}
                        className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg border-none"
                    >
                        Feedback
                    </Button>
                </div>

                <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-4xl font-bold text-white shadow-lg border-4 border-surface-light dark:border-surface-dark">
                        {user?.username?.[0]?.toUpperCase()}
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-accent text-white text-xs px-2 py-1 rounded-full shadow-md font-bold">
                        Lvl {Math.floor(stats.credits / 1000) + 1}
                    </div>
                </div>

                <div className="flex-1 text-center md:text-left">
                    <h1 className="text-3xl font-bold text-text-light dark:text-text-dark mb-1">{user?.username}</h1>
                    <p className="text-text-muted-light dark:text-text-muted-dark flex items-center justify-center md:justify-start gap-2">
                        <Award size={16} /> {stats.rank} &bull; {user?.email}
                    </p>
                </div>

                <div className="flex gap-4">
                    <div className="glass-card px-6 py-3 rounded-xl text-center">
                        <div className="text-xs text-text-muted-dark uppercase tracking-wide">Credits</div>
                        <div className="text-2xl font-bold text-primary-light">{stats.credits}</div>
                    </div>
                    <div className="glass-card px-6 py-3 rounded-xl text-center">
                        <div className="text-xs text-text-muted-dark uppercase tracking-wide">Avg Bloom</div>
                        <div className="text-2xl font-bold text-secondary-light">{stats.bloomScore}</div>
                    </div>
                </div>
            </header>

            {/* Main Content Vertical Stack */}
            <div className="space-y-8">

                {/* 1. Login Activity (Heatmap) */}
                <section>
                    <ActivityHeatmap userId={user?._id} />
                </section>

                {/* 2. Bounty Section */}
                <section>
                    <h2 className="text-xl font-bold vibrant-text mb-4 flex items-center gap-2">
                        <Target className="text-accent" /> Active Challenges
                    </h2>
                    <BountyBoard bounties={bounties} onComplete={handleClaimBounty} />
                </section>

                {/* 3. Skill Map (Skill Tree) */}
                <section>
                    <h2 className="text-xl font-bold vibrant-text mb-4 flex items-center gap-2">
                        <Brain className="text-primary" /> Knowledge Map
                    </h2>
                    <SkillTree />
                </section>

            </div>

            <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        </div>
    );
};

export default ProfilePage;
