'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';
import {
    RefreshCw,
    BookOpen,
    Search,
    Calendar,
    Eye,
    EyeOff,
    Shield,
    FileText,
} from 'lucide-react';

interface JournalEntry {
    id: string;
    entryNumber: string;
    entryDate: string;
    entryType: string;
    totalDebit: string;
    totalCredit: string;
    narration: string;
    status: string;
    ledgerVisibility: string;
}

interface LedgerPageProps {
    visibility: 'public' | 'private';
}

function LedgerPage({ visibility }: LedgerPageProps) {
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [dateRange, setDateRange] = useState({
        dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        dateTo: new Date().toISOString().split('T')[0],
    });
    const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0 });

    useEffect(() => {
        fetchEntries();
    }, [dateRange, search]);

    const fetchEntries = async () => {
        try {
            setLoading(true);
            const res = await apiClient.get('/accounting/journal-entries', {
                params: {
                    visibility,
                    dateFrom: dateRange.dateFrom,
                    dateTo: dateRange.dateTo,
                    search: search || undefined,
                    limit: pagination.limit,
                    offset: pagination.offset,
                },
            });
            if (res.data.success) {
                setEntries(res.data.data);
                setPagination(prev => ({ ...prev, total: res.data.pagination?.total || 0 }));
            }
        } catch (err) {
            console.error('Failed to fetch entries:', err);
        } finally {
            setLoading(false);
        }
    };

    const isPublic = visibility === 'public';
    const icon = isPublic ? Eye : EyeOff;
    const Icon = icon;
    const color = isPublic ? 'text-green-600' : 'text-orange-600';
    const bgColor = isPublic ? 'bg-green-50' : 'bg-orange-50';

    const totalDebit = entries.reduce((sum, e) => sum + parseFloat(e.totalDebit || '0'), 0);
    const totalCredit = entries.reduce((sum, e) => sum + parseFloat(e.totalCredit || '0'), 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Icon className={`h-8 w-8 ${color}`} />
                        {isPublic ? 'Public Ledger' : 'Private Ledger'}
                    </h1>
                    <p className="text-gray-500 mt-1">
                        {isPublic
                            ? 'Government-compliant accounting records (tax & audit ready)'
                            : 'Internal management entries (visible to owners only)'}
                    </p>
                </div>
                <Button onClick={fetchEntries} variant="outline" disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <Card className={`p-4 ${bgColor} border-none`}>
                <div className="flex items-center gap-2">
                    <Shield className={`h-5 w-5 ${color}`} />
                    <span className="font-medium">
                        {isPublic
                            ? 'These entries are visible in formal reports and tax filings.'
                            : 'These entries are restricted to superadmin and owner roles.'}
                    </span>
                </div>
            </Card>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search entries..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <Input
                        type="date"
                        value={dateRange.dateFrom}
                        onChange={(e) => setDateRange(prev => ({ ...prev, dateFrom: e.target.value }))}
                        className="w-36"
                    />
                    <span className="text-gray-400">-</span>
                    <Input
                        type="date"
                        value={dateRange.dateTo}
                        onChange={(e) => setDateRange(prev => ({ ...prev, dateTo: e.target.value }))}
                        className="w-36"
                    />
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-6">
                    <p className="text-sm text-gray-500">Entries</p>
                    <p className="text-2xl font-bold mt-1">{pagination.total}</p>
                </Card>
                <Card className="p-6">
                    <p className="text-sm text-gray-500">Total Debits</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(totalDebit)}</p>
                </Card>
                <Card className="p-6">
                    <p className="text-sm text-gray-500">Total Credits</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(totalCredit)}</p>
                </Card>
            </div>

            {/* Entries table */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="text-center py-12">
                            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                        </div>
                    ) : entries.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="text-left p-3">Entry #</th>
                                        <th className="text-left p-3">Date</th>
                                        <th className="text-left p-3">Type</th>
                                        <th className="text-left p-3">Narration</th>
                                        <th className="text-right p-3">Debit</th>
                                        <th className="text-right p-3">Credit</th>
                                        <th className="text-center p-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map((entry) => (
                                        <tr key={entry.id} className="border-t hover:bg-gray-50">
                                            <td className="p-3 font-mono text-xs">{entry.entryNumber}</td>
                                            <td className="p-3 whitespace-nowrap">
                                                {new Date(entry.entryDate).toLocaleDateString()}
                                            </td>
                                            <td className="p-3">
                                                <Badge variant="secondary" className="capitalize text-xs">
                                                    {entry.entryType}
                                                </Badge>
                                            </td>
                                            <td className="p-3 max-w-xs truncate">{entry.narration || '-'}</td>
                                            <td className="p-3 text-right font-medium">
                                                {formatCurrency(parseFloat(entry.totalDebit))}
                                            </td>
                                            <td className="p-3 text-right font-medium">
                                                {formatCurrency(parseFloat(entry.totalCredit))}
                                            </td>
                                            <td className="p-3 text-center">
                                                <Badge
                                                    variant={entry.status === 'posted' ? 'default' : 'secondary'}
                                                    className="text-xs capitalize"
                                                >
                                                    {entry.status}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">No {visibility} entries found for the selected period</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default LedgerPage;
