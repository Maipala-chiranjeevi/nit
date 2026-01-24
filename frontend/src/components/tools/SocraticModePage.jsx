import React, { useState, useRef, useEffect } from 'react';
import api from '../../services/api.js';
import toast from 'react-hot-toast';
import Button from '../core/Button.jsx';
import { Send, FileText, ArrowLeft, Loader2, UploadCloud, Plus, MessageSquare, Trash2, BookOpen, CheckCircle, Circle, GraduationCap, Network } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import StudyPlanGraph from './StudyPlanGraph.jsx';

export default function SocraticModePage() {
    const [sessions, setSessions] = useState([]);
    const [currentSession, setCurrentSession] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [generatingPlan, setGeneratingPlan] = useState(false); // New state for plan generation
    const [showGraph, setShowGraph] = useState(false); // State for graph toggle
    const messagesEndRef = useRef(null);

    // Load Sessions on Mount
    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        try {
            const data = await api.getSocraticSessions();
            setSessions(data);
        } catch (error) {
            console.error("Failed to load sessions:", error);
        }
    };

    const loadSessionHistory = async (sessionId) => {
        const toastId = toast.loading("Loading chat history...");
        try {
            const session = await api.getSocraticHistory(sessionId);
            setCurrentSession(session);
            setMessages(session.messages || []);
            toast.success("Chat loaded", { id: toastId });
        } catch (error) {
            toast.error("Failed to load history", { id: toastId });
        }
    };

    const handleDeleteSession = async (e, sessionId) => {
        e.stopPropagation(); // Prevent opening the session when clicking delete
        if (!window.confirm("Are you sure you want to delete this session?")) return;

        const toastId = toast.loading("Deleting session...");
        try {
            await api.deleteSocraticSession(sessionId);
            toast.success("Session deleted", { id: toastId });

            // If deleting current session, clear view
            if (currentSession?._id === sessionId) {
                setCurrentSession(null);
                setMessages([]);
            }

            loadSessions(); // Refresh list
        } catch (error) {
            toast.error("Failed to delete", { id: toastId });
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleFileUpload = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        const toastId = toast.loading(`Uploading ${files.length} file(s)...`);

        try {
            let lastSession = currentSession;
            let successCount = 0;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                toast.loading(`Uploading ${i + 1}/${files.length}: ${file.name}`, { id: toastId });

                // Upload returns { sessionId, message, cached }
                // For the first file, we might pass currentSession?._id
                // For subsequent files, we MUST pass the sessionId returned from the first upload to append to the SAME session
                const targetSessionId = lastSession?._id || (i > 0 ? lastSession?._id : null);

                const data = await api.socraticUpload(file, targetSessionId);

                // Fetch the full new session after EACH upload to ensure we have the latest state (and sessionId for next loop)
                lastSession = await api.getSocraticHistory(data.sessionId);
                successCount++;
            }

            setCurrentSession(lastSession);
            setMessages(lastSession.messages);

            toast.success(`Successfully uploaded ${successCount} files!`, { id: toastId });
            loadSessions(); // Refresh list

        } catch (error) {
            console.error("Upload Error:", error);
            const msg = error.response?.data?.message || error.message || "Upload failed.";
            toast.error(`Error: ${msg}`, { id: toastId, duration: 5000 });
        } finally {
            setIsUploading(false);
            // Reset file input
            if (e.target) e.target.value = null;
        }
    };

    const handleSendMessage = async (e) => {
        e?.preventDefault();
        if (!input.trim() || !currentSession || isLoading) return;

        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await api.socraticChat({
                message: userMsg.content,
                sessionId: currentSession._id
            });

            const assistantMsg = { role: 'assistant', content: response.response };
            setMessages(prev => [...prev, assistantMsg]);
        } catch (error) {
            const msg = error.response?.data?.message || "Failed to get response.";
            toast.error(msg);
            setMessages(prev => [...prev, { role: 'assistant', content: "⚠️ I encountered an error. Please try again." }]);
        } finally {
            setIsLoading(false);
        }
    };

    // --- NEW: Handle Learning Level Update ---
    const handleUpdateLevel = async (level) => {
        if (!currentSession) return;
        const toastId = toast.loading(`Setting level to ${level}...`);
        try {
            await api.setLearningLevel(currentSession._id, level);
            setCurrentSession(prev => ({ ...prev, learningLevel: level }));
            toast.success(`Level set to ${level.charAt(0).toUpperCase() + level.slice(1)}`, { id: toastId });

            // Optionally add system message
            setMessages(prev => [...prev, { role: 'assistant', content: `Adjusting my explanations for a **${level}** level.` }]);
        } catch (error) {
            toast.error("Failed to update level", { id: toastId });
        }
    };

    // --- NEW: Handle Generate Plan ---
    const handleGeneratePlan = async () => {
        if (!currentSession) return;
        setGeneratingPlan(true);
        const toastId = toast.loading("Generating study plan...");
        try {
            const updatedSession = await api.generateStudyPlan(currentSession._id);
            setCurrentSession(updatedSession);
            setMessages(updatedSession.messages); // Plan generation adds a message
            toast.success("Study plan generated!", { id: toastId });
        } catch (error) {
            toast.error("Failed to generate plan", { id: toastId });
        } finally {
            setGeneratingPlan(false);
        }
    };

    // --- NEW: Handle Topic Status Update ---
    // --- NEW: Handle Topic Status Update ---
    const handleUpdateTopicStatus = async (moduleIndex, subtopicIndex, status) => {
        if (!currentSession) return;
        try {
            // Check if we are updating a module (2 args) or subtopic (3 args)
            // If subtopicIndex is string (e.g. 'completed'), it means it was called as (index, status) - old way?
            // No, the render loop uses (mIndex, tIndex, 'status') OR (mIndex, 'status')?
            // Let's standardise.

            // If called from the render loop I added: (mIndex, tIndex, 'status')

            const updatedSession = await api.updateTopicStatus(currentSession._id, moduleIndex, subtopicIndex, status);
            setCurrentSession(updatedSession);
            // If the status update triggered a "next topic" message, update messages
            if (updatedSession.messages.length > messages.length) {
                setMessages(updatedSession.messages);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to update status");
        }
    };

    return (
        <div className="h-full flex bg-background-light dark:bg-background-dark overflow-hidden">

            {/* Sidebar (Session List) */}
            <div className="w-64 border-r border-border-light dark:border-border-dark flex flex-col bg-surface-light dark:bg-surface-dark shrink-0">
                <div className="p-4 border-b border-border-light dark:border-border-dark">
                    <Button
                        variant="primary"
                        fullWidth
                        leftIcon={<Plus size={16} />}
                        onClick={() => { setCurrentSession(null); setMessages([]); }}
                    >
                        New Session
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {sessions.length === 0 && (
                        <div className="text-center p-4 text-xs text-text-muted-light dark:text-text-muted-dark opacity-70">
                            No past sessions
                        </div>
                    )}
                    {sessions.map(session => (
                        <div
                            key={session._id}
                            onClick={() => loadSessionHistory(session._id)}
                            className={`group relative p-3 rounded-lg cursor-pointer text-sm transition-colors flex items-center gap-3 pr-8
                                ${currentSession?._id === session._id
                                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium'
                                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-text-light dark:text-text-dark'
                                }`}
                        >
                            <MessageSquare size={16} className="shrink-0 opacity-70" />
                            <div className="truncate min-w-0 flex-1">
                                <div className="truncate">{session.filename}</div>
                                <div className="text-[10px] opacity-60 font-normal">
                                    {new Date(session.updatedAt || session.createdAt).toLocaleDateString()}
                                </div>
                            </div>
                            <button
                                onClick={(e) => handleDeleteSession(e, session._id)}
                                className="absolute right-2 p-1.5 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all"
                                title="Delete Session"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex min-w-0">

                {/* Chat Column */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <div className="shrink-0 p-4 border-b border-border-light dark:border-border-dark flex items-center justify-between bg-surface-light dark:bg-surface-dark shadow-sm z-10">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/10 rounded-lg">
                                <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h1 className="text-xl font-bold text-text-light dark:text-text-dark truncate">Socratic Tutor</h1>
                                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                                    {!currentSession ? (
                                        <p className="text-xs text-text-muted-light dark:text-text-muted-dark">
                                            Start a new learning session
                                        </p>
                                    ) : (
                                        <div className="flex gap-1">
                                            {currentSession.filenames?.map((fname, i) => (
                                                <span key={i} className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 whitespace-nowrap">
                                                    {fname}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {currentSession && (
                            <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors text-sm font-medium">
                                {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                <span>Add Doc</span>
                                <input type="file" className="hidden" accept=".pdf,.txt,.md" multiple onChange={handleFileUpload} disabled={isUploading} />
                            </label>
                        )}
                    </div>

                    {/* Chat Body */}
                    <div className="flex-1 overflow-hidden relative">
                        {!currentSession ? (
                            <div className="h-full flex flex-col items-center justify-center p-6 animate-fadeIn">
                                <div className="max-w-md w-full bg-surface-light dark:bg-surface-dark p-8 rounded-2xl shadow-xl border border-border-light dark:border-border-dark text-center">
                                    <h2 className="text-2xl font-bold mb-2 text-text-light dark:text-text-dark">Start Learning</h2>
                                    <p className="text-text-muted-light dark:text-text-muted-dark mb-8 text-sm">
                                        Upload a document to begin. <br />
                                        <span className="opacity-70 text-xs">You can add more files later to combine contexts!</span>
                                    </p>

                                    <label className="cursor-pointer flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border-light dark:border-border-dark rounded-xl hover:border-primary transition-colors bg-gray-50 dark:bg-gray-800">
                                        {isUploading ? (
                                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                        ) : (
                                            <>
                                                <UploadCloud className="w-10 h-10 text-primary mb-2" />
                                                <span className="text-sm font-medium text-text-muted-light dark:text-text-muted-dark">Click to Upload Document</span>
                                            </>
                                        )}
                                        <input type="file" className="hidden" accept=".pdf,.txt,.md" multiple onChange={handleFileUpload} disabled={isUploading} />
                                    </label>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col w-full">
                                {/* Chat Area */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                                    {messages.map((msg, index) => (
                                        <div
                                            key={index}
                                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slideUp`}
                                        >
                                            <div
                                                className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-3.5 shadow-sm text-sm leading-relaxed ${msg.role === 'user'
                                                    ? 'bg-purple-600 text-white rounded-tr-none'
                                                    : 'bg-surface-light dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-text-light dark:text-text-dark rounded-tl-none'
                                                    }`}
                                            >
                                                <div className="markdown-content">
                                                    <ReactMarkdown
                                                        components={{
                                                            p: ({ node, ...props }) => <p className={`mb-2 last:mb-0 ${msg.role === 'user' ? 'text-white' : ''}`} {...props} />,
                                                            ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2" {...props} />,
                                                            ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2" {...props} />,
                                                            li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                                                            code: ({ node, inline, className, children, ...props }) => (
                                                                <code className={`${inline ? 'bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded' : 'block bg-gray-900 text-white p-2 rounded mb-2 overflow-x-auto'}`} {...props}>
                                                                    {children}
                                                                </code>
                                                            )
                                                        }}
                                                    >
                                                        {msg.content}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {isLoading && (
                                        <div className="flex justify-start animate-pulse">
                                            <div className="bg-surface-light dark:bg-gray-800 border border-border-light dark:border-border-dark rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                                                <span className="text-xs text-text-muted-light dark:text-text-muted-dark">Reasoning...</span>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input Area */}
                                <div className="p-4 bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark shrink-0">
                                    <form onSubmit={handleSendMessage} className="relative flex items-center gap-2 max-w-4xl mx-auto">
                                        <input
                                            type="text"
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            placeholder="Type your answer or question..."
                                            disabled={isLoading}
                                            className="flex-1 input-field py-3 pr-12 shadow-sm focus:ring-2 focus:ring-purple-500/20"
                                        />
                                        <button
                                            type="submit"
                                            disabled={!input.trim() || isLoading}
                                            className="absolute right-2 p-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        >
                                            <Send size={18} />
                                        </button>
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Study Plan & Settings */}
                {currentSession && (
                    <div className="w-80 border-l border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-900/30 flex flex-col shrink-0">
                        <div className="p-4 border-b border-border-light dark:border-border-dark">
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-text-light dark:text-text-dark">
                                <GraduationCap size={16} className="text-purple-600" />
                                Learning Settings
                            </h3>

                            {/* Learning Level Selector */}
                            <div className="bg-surface-light dark:bg-gray-800 p-3 rounded-lg border border-border-light dark:border-border-dark mb-4 shadow-sm">
                                <label className="text-xs text-text-muted-light dark:text-text-muted-dark font-medium mb-1.5 block">Learning Level</label>
                                <div className="flex gap-1">
                                    {['beginner', 'intermediate', 'advanced'].map(level => (
                                        <button
                                            key={level}
                                            onClick={() => handleUpdateLevel(level)}
                                            className={`flex-1 text-[10px] py-1.5 px-1 rounded capitalize transition-all
                                                ${currentSession.learningLevel === level
                                                    ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800'
                                                    : 'text-text-muted-light dark:text-text-muted-dark hover:bg-gray-100 dark:hover:bg-gray-700'
                                                }`}
                                        >
                                            {level}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Study Plan Section */}
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted-light dark:text-text-muted-dark">Study Plan</h3>
                                <div className="flex items-center gap-2">
                                    {(!currentSession.studyPlan || currentSession.studyPlan.length === 0) && (
                                        <button
                                            onClick={handleGeneratePlan}
                                            disabled={generatingPlan}
                                            className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                                        >
                                            {generatingPlan ? <Loader2 size={10} className="animate-spin" /> : <BookOpen size={10} />}
                                            Generate
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowGraph(!showGraph)}
                                        className="text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 p-1 rounded"
                                        title={showGraph ? "Show List" : "Show Graph"}
                                    >
                                        {showGraph ? <BookOpen size={14} /> : <Network size={14} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {!currentSession.studyPlan || currentSession.studyPlan.length === 0 ? (
                                <div className="text-center py-8 px-4 opacity-60">
                                    <BookOpen size={32} className="mx-auto mb-2 text-gray-400" />
                                    <p className="text-xs text-text-muted-light dark:text-text-muted-dark">
                                        No study plan yet. Click "Generate" to create a structured path from your documents.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {showGraph ? (
                                        <StudyPlanGraph
                                            plan={currentSession.studyPlan}
                                            onNodeClick={(index) => {
                                                // Optional: Scroll to topic or show details
                                                console.log("Clicked topic index:", index);
                                            }}
                                        />
                                    ) : (
                                        <div className="space-y-4">
                                            {currentSession.studyPlan.map((module, mIndex) => (
                                                <div key={mIndex} className="mb-4">
                                                    {/* Module */}
                                                    <div className={`relative pl-4 border-l-2 mb-2 ${module.status === 'completed' ? 'border-green-500' : module.status === 'in-progress' ? 'border-purple-500' : 'border-gray-300 dark:border-gray-700'}`}>
                                                        <div
                                                            className={`absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full border-2 
                                                            ${module.status === 'completed' ? 'bg-green-500 border-green-500' : module.status === 'in-progress' ? 'bg-white dark:bg-gray-900 border-purple-500' : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700'}`}
                                                        />
                                                        <div className="mb-1 flex items-start justify-between gap-2">
                                                            <h4 className={`text-sm font-bold leading-tight ${module.status === 'completed' ? 'text-green-700 dark:text-green-400' : module.status === 'in-progress' ? 'text-purple-700 dark:text-purple-300' : 'text-text-light dark:text-text-dark'}`}>
                                                                {module.topic}
                                                            </h4>

                                                            {/* Module Status Toggle */}
                                                            <div className="flex shrink-0">
                                                                {module.status !== 'completed' && (
                                                                    <button
                                                                        onClick={() => handleUpdateTopicStatus(mIndex, null, 'completed')}
                                                                        className="text-gray-400 hover:text-green-500" title="Mark Module Complete"
                                                                    >
                                                                        <CheckCircle size={14} />
                                                                    </button>
                                                                )}
                                                                {module.status === 'completed' && (
                                                                    <button
                                                                        onClick={() => handleUpdateTopicStatus(mIndex, null, 'in-progress')}
                                                                        className="text-green-500 hover:text-purple-500" title="Mark Module In Progress"
                                                                    >
                                                                        <CheckCircle size={14} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <p className="text-xs text-text-muted-light dark:text-text-muted-dark leading-relaxed mb-2">
                                                            {module.description}
                                                        </p>
                                                    </div>

                                                    {/* Subtopics */}
                                                    {module.subtopics && module.subtopics.length > 0 && (
                                                        <div className="ml-4 space-y-2 border-l border-gray-200 dark:border-gray-800 pl-3">
                                                            {module.subtopics.map((sub, sIndex) => (
                                                                <div key={sIndex} className="relative">
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <span className={`text-xs ${sub.status === 'completed' ? 'text-green-600 dark:text-green-400 line-through opacity-70' : sub.status === 'in-progress' ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                                                                            {sub.topic}
                                                                        </span>
                                                                        <div className="flex shrink-0">
                                                                            {sub.status !== 'completed' && (
                                                                                <button
                                                                                    onClick={() => handleUpdateTopicStatus(mIndex, sIndex, 'completed')}
                                                                                    className="text-gray-400 hover:text-green-500 scale-75" title="Mark Subtopic Complete"
                                                                                >
                                                                                    <CheckCircle size={14} />
                                                                                </button>
                                                                            )}
                                                                            {sub.status === 'completed' && (
                                                                                <button
                                                                                    onClick={() => handleUpdateTopicStatus(mIndex, sIndex, 'in-progress')}
                                                                                    className="text-green-500 hover:text-purple-500 scale-75" title="Mark Subtopic In Progress"
                                                                                >
                                                                                    <CheckCircle size={14} />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )
                }
            </div >
        </div >
    );
}
