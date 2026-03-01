'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Database,
    Download,
    RefreshCw,
    AlertTriangle,
    FileText,
    Clock,
    HardDrive,
    CheckCircle2,
    XCircle
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { format } from 'date-fns';

interface BackupFile {
    filename: string;
    size: number;
    createdAt: string;
    path: string;
}

export default function BackupPage() {
    const [backups, setBackups] = useState<BackupFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isRestoring, setIsRestoring] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        fetchBackups();
    }, []);

    const fetchBackups = async () => {
        try {
            setIsLoading(true);
            const response = await apiClient.get('/backups');
            if (response.data.success) {
                setBackups(response.data.data || []);
            }
        } catch (err: any) {
            console.error('Failed to fetch backups:', err);
            setError('Failed to load backups list');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateBackup = async () => {
        try {
            setIsCreating(true);
            setError(null);
            setSuccess(null);

            const response = await apiClient.post('/backups', {
                backupType: 'full'
            });

            if (response.data.success) {
                setSuccess('Backup created successfully');
                await fetchBackups();
            }
        } catch (err: any) {
            console.error('Failed to create backup:', err);
            setError(err.response?.data?.error || 'Failed to create backup');
        } finally {
            setIsCreating(false);
        }
    };

    const handleRestore = async (filename: string) => {
        if (!confirm('WARNING: This will overwrite your current database. This action cannot be undone. Are you sure you want to proceed?')) {
            return;
        }

        try {
            setIsRestoring(filename);
            setError(null);
            setSuccess(null);

            const response = await apiClient.post('/backups/restore', {
                backupFileName: filename
            });

            if (response.data.success) {
                setSuccess('Database restored successfully');
            }
        } catch (err: any) {
            console.error('Failed to restore backup:', err);
            setError(err.response?.data?.error || 'Failed to restore backup');
        } finally {
            setIsRestoring(null);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Data & Backup</h1>
                    <p className="text-gray-600 mt-1">Manage system backups and restoration</p>
                </div>
                <Button
                    onClick={handleCreateBackup}
                    disabled={isCreating || isRestoring !== null}
                >
                    {isCreating ? (
                        <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Creating...
                        </>
                    ) : (
                        <>
                            <Database className="h-4 w-4 mr-2" />
                            Create New Backup
                        </>
                    )}
                </Button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md flex items-center gap-2">
                    <XCircle className="h-5 w-5" />
                    <p className="text-sm">{error}</p>
                </div>
            )}

            {success && (
                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    <p className="text-sm">{success}</p>
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Available Backups</CardTitle>
                    <CardDescription>
                        List of automated and manual backups available for restoration
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-12 text-gray-500">
                            <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin" />
                            Loading backups...
                        </div>
                    ) : backups.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Database className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p>No backups found</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {backups.map((backup, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                            <FileText className="h-5 w-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-gray-900">{backup.filename}</h4>
                                            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <HardDrive className="h-3 w-3" />
                                                    {formatSize(backup.size)}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {new Date(backup.createdAt).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={isCreating || isRestoring !== null}
                                            onClick={() => {
                                                // TODO: Implement download if backend supports serving the file
                                                alert('Download not implemented yet');
                                            }}
                                        >
                                            <Download className="h-4 w-4 mr-2" />
                                            Download
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            disabled={isCreating || isRestoring !== null}
                                            onClick={() => handleRestore(backup.filename)}
                                        >
                                            {isRestoring === backup.filename ? (
                                                <RefreshCw className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <AlertTriangle className="h-4 w-4 mr-2" />
                                            )}
                                            Restore
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
