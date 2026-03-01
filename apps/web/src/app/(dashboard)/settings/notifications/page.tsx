'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Mail, MessageSquare } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface NotificationStatus {
    email: {
        configured: boolean;
        provider: string;
    };
    whatsapp: {
        configured: boolean;
        provider: string;
    };
}

export default function NotificationsSettingsPage() {
    const [status, setStatus] = useState<NotificationStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchStatus();
    }, []);

    async function fetchStatus() {
        try {
            setLoading(true);
            const response = await apiClient.get('/notifications/status');
            if (response.data && response.data.success) {
                // The API returns { success: true, data: { ... } }
                // So we need to access response.data.data or assume the client unwraps it
                // Based on typical patterns, it sends response.data as the body.
                // Let's assume standard axois response structure: response.data is the body.
                // The body is { success: true, data: {...} }
                setStatus(response.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch notification status:', err);
            setError('Failed to load notification status');
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-red-500 bg-red-50 rounded-lg">
                {error}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Notification Settings</h1>
                <p className="text-muted-foreground">
                    View the status of your notification services
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Email Settings */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Mail className="h-5 w-5 text-blue-600" />
                            <CardTitle>Email Notifications</CardTitle>
                        </div>
                        <CardDescription>
                            Status of email delivery service (SMTP)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <span className="font-medium">Status</span>
                                {status?.email.configured ? (
                                    <Badge className="bg-green-600">Configured</Badge>
                                ) : (
                                    <Badge variant="destructive">Not Configured</Badge>
                                )}
                            </div>

                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <span className="font-medium">Provider</span>
                                <span className="text-sm text-muted-foreground">
                                    {status?.email.provider || 'SMTP'}
                                </span>
                            </div>

                            {!status?.email.configured && (
                                <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
                                    Please configure SMTP settings in your environment variables to enable email notifications.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* WhatsApp Settings */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-green-600" />
                            <CardTitle>WhatsApp Notifications</CardTitle>
                        </div>
                        <CardDescription>
                            Status of WhatsApp integration (Green API)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <span className="font-medium">Status</span>
                                {status?.whatsapp.configured ? (
                                    <Badge className="bg-green-600">Configured</Badge>
                                ) : (
                                    <Badge variant="destructive">Not Configured</Badge>
                                )}
                            </div>

                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <span className="font-medium">Provider</span>
                                <span className="text-sm text-muted-foreground">
                                    {status?.whatsapp.provider || 'Green API'}
                                </span>
                            </div>

                            {!status?.whatsapp.configured && (
                                <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
                                    Please configure Green API settings in your environment variables to enable WhatsApp notifications.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Configuration</CardTitle>
                    <CardDescription>
                        How to configure these services
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Notification services are currently configured via environment variables on the server.
                            To update these settings, please contact your system administrator.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className="p-4 border rounded-lg">
                                <h4 className="font-semibold mb-2">Email Variables</h4>
                                <ul className="text-xs space-y-1 font-mono text-muted-foreground">
                                    <li>EMAIL_HOST</li>
                                    <li>EMAIL_PORT</li>
                                    <li>EMAIL_USER</li>
                                    <li>EMAIL_PASSWORD</li>
                                    <li>EMAIL_FROM</li>
                                </ul>
                            </div>

                            <div className="p-4 border rounded-lg">
                                <h4 className="font-semibold mb-2">WhatsApp Variables</h4>
                                <ul className="text-xs space-y-1 font-mono text-muted-foreground">
                                    <li>WHATSAPP_INSTANCE_ID</li>
                                    <li>WHATSAPP_API_TOKEN</li>
                                    <li>WHATSAPP_API_URL</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
