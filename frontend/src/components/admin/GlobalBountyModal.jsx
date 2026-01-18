// frontend/src/components/admin/GlobalBountyModal.jsx
import React, { useState } from 'react';
import Button from '../core/Button.jsx';
import toast from 'react-hot-toast';
import { Target, Users } from 'lucide-react';
import * as adminApi from '../../services/adminApi.js';

const GlobalBountyModal = ({ onClose }) => {
    const [formData, setFormData] = useState({
        question: '',
        topic: '',
        difficulty: 'medium',
        reward: 50
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await adminApi.createGlobalBounty(formData);
            toast.success("Global Bounty Sent to All Users!");
            onClose();
        } catch (error) {
            toast.error(error.message || "Failed to create bounty.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg flex items-start gap-3">
                <Users className="text-blue-400 mt-1" size={20} />
                <div>
                    <h4 className="font-semibold text-blue-200">Broadcast Challenge</h4>
                    <p className="text-sm text-blue-300">This will add a new bounty to <strong>every student's</strong> active challenges list immediately.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-text-muted-dark mb-1">Topic</label>
                    <input
                        name="topic"
                        value={formData.topic}
                        onChange={handleChange}
                        placeholder="e.g. Distributed Systems"
                        className="input-field w-full"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-text-muted-dark mb-1">Challenge Question</label>
                    <textarea
                        name="question"
                        value={formData.question}
                        onChange={handleChange}
                        placeholder="e.g. Explain CAP theorem with a real-world example."
                        className="input-field w-full min-h-[100px]"
                        required
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-text-muted-dark mb-1">Difficulty</label>
                        <select
                            name="difficulty"
                            value={formData.difficulty}
                            onChange={handleChange}
                            className="input-field w-full"
                        >
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-muted-dark mb-1">XP Reward</label>
                        <input
                            type="number"
                            name="reward"
                            value={formData.reward}
                            onChange={handleChange}
                            className="input-field w-full"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border-dark mt-4">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button type="submit" isLoading={loading} leftIcon={<Target size={16} />}>Broadcast Bounty</Button>
                </div>
            </form>
        </div>
    );
};

export default GlobalBountyModal;
