// frontend/src/components/admin/AdminUserList.jsx
import React, { useState, useEffect } from 'react';
import * as adminApi from '../../services/adminApi.js';
import { Loader2, Eye, User, Award, Star } from 'lucide-react';
import IconButton from '../core/IconButton.jsx';
import Modal from '../core/Modal.jsx';
import ProfilePage from '../../pages/ProfilePage.jsx';

const AdminUserList = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUserId, setSelectedUserId] = useState(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await adminApi.getAllUsers();
            setUsers(data);
        } catch (error) {
            console.error("Failed to load users:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" size={32} /></div>;
    }

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th className="px-4 py-3 font-medium rounded-tl-lg">Student</th>
                            <th className="px-4 py-3 font-medium">Email</th>
                            <th className="px-4 py-3 font-medium text-center">Level</th>
                            <th className="px-4 py-3 font-medium text-center">Bloom Score</th>
                            <th className="px-4 py-3 font-medium text-center">Bounties</th>
                            <th className="px-4 py-3 font-medium rounded-tr-lg text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user._id} className="border-b border-border-light dark:border-border-dark hover:bg-white/5 transition-colors">
                                <td className="px-4 py-3 font-semibold text-text-light dark:text-text-dark">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-surface-dark border border-white/10 flex items-center justify-center text-xs">
                                            {user.username?.[0]?.toUpperCase()}
                                        </div>
                                        {user.username}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-text-muted-light dark:text-text-muted-dark">{user.email}</td>
                                <td className="px-4 py-3 text-center">
                                    <span className="bg-primary/20 text-primary px-2 py-1 rounded-full text-xs font-bold">
                                        Lvl {Math.floor((user.profile?.learningCredits || 0) / 1000) + 1}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center font-mono">
                                    {user.profile?.bloomScore?.toFixed(1) || '0.0'}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {user.profile?.activeBounties?.length || 0}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <IconButton
                                        icon={Eye}
                                        size="sm"
                                        variant="ghost"
                                        className="text-primary hover:text-primary-light"
                                        onClick={() => setSelectedUserId(user._id)}
                                        title="View Full Profile"
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Profile View Modal */}
            <Modal
                isOpen={!!selectedUserId}
                onClose={() => setSelectedUserId(null)}
                title="Student Profile View"
                size="6xl"
                className="h-[90vh]"
            >
                {selectedUserId && (
                    <div className="h-full overflow-hidden">
                        <ProfilePage viewedUserId={selectedUserId} />
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default AdminUserList;
