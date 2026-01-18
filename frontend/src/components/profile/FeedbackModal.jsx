import React, { useState } from 'react';
import Modal from '../core/Modal';
import Button from '../core/Button';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { MessageSquare, Send, AlertCircle, Bug, Lightbulb } from 'lucide-react';

const FeedbackModal = ({ isOpen, onClose }) => {
    const [type, setType] = useState('general');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim()) {
            toast.error('Please enter a message');
            return;
        }

        setIsSubmitting(true);
        try {
            await api.submitFeedback(type, message);
            toast.success('Thank you for your feedback!');
            setMessage('');
            setType('general');
            onClose();
        } catch (error) {
            toast.error('Failed to submit feedback. Please try again.');
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getTypeIcon = (t) => {
        switch (t) {
            case 'bug': return <Bug size={18} />;
            case 'feature': return <Lightbulb size={18} />;
            default: return <MessageSquare size={18} />;
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Send Feedback" size="md">
            <form onSubmit={handleSubmit} className="space-y-6 pt-2">

                <div className="space-y-4">
                    <label className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-2">
                        What kind of feedback is this?
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                        {['general', 'bug', 'feature'].map(t => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setType(t)}
                                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${type === t
                                        ? 'bg-primary/10 border-primary text-primary'
                                        : 'bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark hover:border-primary/50 text-text-muted-light dark:text-text-muted-dark'
                                    }`}
                            >
                                {getTypeIcon(t)}
                                <span className="capitalize text-sm font-medium">{t}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-2">
                        Your Message
                    </label>
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Tell us what you think..."
                        className="w-full h-32 p-4 rounded-xl resize-none bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                        required
                    />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="ghost" onClick={onClose} type="button">
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        isLoading={isSubmitting}
                        leftIcon={<Send size={16} />}
                        className="bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/20"
                    >
                        Submit Feedback
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default FeedbackModal;
