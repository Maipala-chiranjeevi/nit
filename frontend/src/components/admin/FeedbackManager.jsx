import React, { useState, useEffect } from 'react';
import * as adminApi from '../../services/adminApi';
import { MessageSquare, Bug, Lightbulb, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const FeedbackManager = () => {
    const [feedbacks, setFeedbacks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFeedback();
    }, []);

    const fetchFeedback = async () => {
        try {
            setLoading(true);
            const data = await adminApi.getPlatformFeedback();
            setFeedbacks(data || []);
        } catch (error) {
            console.error('Failed to fetch feedback:', error);
            toast.error('Failed to load feedback');
        } finally {
            setLoading(false);
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'bug': return <Bug size={16} className="text-red-500" />;
            case 'feature': return <Lightbulb size={16} className="text-yellow-500" />;
            default: return <MessageSquare size={16} className="text-blue-500" />;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'new': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'read': return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
            case 'in-progress': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
            case 'resolved': return 'bg-green-500/10 text-green-500 border-green-500/20';
            default: return 'bg-gray-500/10 text-gray-500';
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-text-muted-light dark:text-text-muted-dark">Loading feedback...</div>;
    }

    return (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar p-2">
            {feedbacks.length === 0 ? (
                <div className="text-center py-10 text-text-muted-light dark:text-text-muted-dark">
                    No feedback received yet.
                </div>
            ) : (
                feedbacks.map((item) => (
                    <div key={item._id} className="card-base p-4 border border-border-light dark:border-border-dark flex gap-4">
                        <div className="mt-1">
                            {getTypeIcon(item.type)}
                        </div>
                        <div className="flex-1 space-y-2">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="text-sm font-semibold text-text-light dark:text-text-dark uppercase tracking-wide opacity-70">
                                        {item.type}
                                    </h4>
                                    <p className="text-xs text-text-muted-light dark:text-text-muted-dark">
                                        From: <span className="font-medium text-primary">{item.user?.username || 'Unknown'}</span> ({item.user?.email})
                                    </p>
                                </div>
                                <span className="text-xs text-text-muted-light dark:text-text-muted-dark whitespace-nowrap">
                                    {format(new Date(item.createdAt), 'MMM d, HH:mm')}
                                </span>
                            </div>

                            <p className="text-text-light dark:text-text-dark bg-surface-light dark:bg-surface-dark p-3 rounded-lg text-sm whitespace-pre-wrap">
                                {item.message}
                            </p>

                            <div className="flex gap-2 justify-end">
                                <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(item.status)} capitalize`}>
                                    {item.status}
                                </span>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

export default FeedbackManager;
