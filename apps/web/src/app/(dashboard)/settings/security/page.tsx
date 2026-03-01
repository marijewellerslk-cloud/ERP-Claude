'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Shield, Smartphone, Laptop, History, LogOut } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';

interface LoginHistoryEntry {
    id: string;
    status: 'success' | 'failed';
    createdAt: string;
    ipAddress?: string;
    userAgent?: string;
}

interface Session {
    id: string;
    createdAt: string;
    expiresAt: string;
    store: {
        name: string;
    };
    userAgent?: string;
    ipAddress?: string;
}

export default function SecurityPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [history, setHistory] = useState<LoginHistoryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRevoking, setIsRevoking] = useState<string | null>(null);
    const { user } = useAuthStore();

    const fetchData = async () => {
        try {
            const [sessionRes, historyRes] = await Promise.all([
                apiClient.get('/auth/sessions'),
                apiClient.get('/auth/history')
            ]);

            if (sessionRes.data.success) setSessions(sessionRes.data.data);
            if (historyRes.data.success) setHistory(historyRes.data.data);
        } catch (error) {
            console.error('Failed to fetch security data', error);
            toast.error('Failed to load security information');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleRevokeSession = async (sessionId: string) => {
        setIsRevoking(sessionId);
        try {
            const res = await apiClient.delete(`/auth/sessions/${sessionId}`);

            if (res.data.success) {
                setSessions(sessions.filter(s => s.id !== sessionId));
                toast.success('Session revoked successfully');
            }
        } catch (error: any) {
            const message = error.response?.data?.error?.message || 'Failed to revoke session';
            toast.error(message);
        } finally {
            setIsRevoking(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Security Settings</h1>
                <p className="text-gray-600">Manage your active sessions and view login history.</p>
            </div>

            <div className="grid gap-6">
                {/* Anti-Spam / Rate Limit Info */}
                <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4 flex items-start gap-3">
                        <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                            <h3 className="font-semibold text-blue-900">Account Protection Active</h3>
                            <p className="text-sm text-blue-700">
                                Your account is protected by intelligent rate limiting and brute-force protection.
                                Suspicious login attempts will be automatically blocked.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Active Sessions */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Laptop className="h-5 w-5" />
                            Active Sessions
                        </CardTitle>
                        <CardDescription>
                            Manage devices where you are currently logged in.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {sessions.length === 0 ? (
                                <p className="text-sm text-gray-500">No active sessions found.</p>
                            ) : (
                                sessions.map((session) => (
                                    <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center border shadow-sm">
                                                <Smartphone className="h-5 w-5 text-gray-500" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">
                                                    {session.store.name}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    Started: {format(new Date(session.createdAt), 'PPP p')}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    Expires: {format(new Date(session.expiresAt), 'PPP p')}
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => handleRevokeSession(session.id)}
                                            disabled={isRevoking === session.id}
                                        >
                                            {isRevoking === session.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <LogOut className="h-4 w-4 mr-2" />
                                            )}
                                            Revoke
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Login History */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <History className="h-5 w-5" />
                            Login History
                        </CardTitle>
                        <CardDescription>
                            Recent login activity for your account.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-medium">
                                    <tr>
                                        <th className="p-3">Status</th>
                                        <th className="p-3">Date & Time</th>
                                        <th className="p-3">Reason / Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {history.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="p-4 text-center text-gray-500">No login history found.</td>
                                        </tr>
                                    ) : (
                                        history.map((entry) => (
                                            <tr key={entry.id} className="hover:bg-gray-50/50">
                                                <td className="p-3">
                                                    <Badge variant={entry.status === 'success' ? 'default' : 'destructive'}
                                                        className={entry.status === 'success' ? 'bg-green-600 hover:bg-green-700' : ''}>
                                                        {entry.status === 'success' ? 'Success' : 'Failed'}
                                                    </Badge>
                                                </td>
                                                <td className="p-3 text-gray-600">
                                                    {format(new Date(entry.createdAt), 'PPP p')}
                                                </td>
                                                <td className="p-3 text-gray-600">
                                                    {entry.status === 'success' ? 'Successful Login' : 'Invalid Credentials'}
                                                    {/* We could show IP here if we had it */}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
