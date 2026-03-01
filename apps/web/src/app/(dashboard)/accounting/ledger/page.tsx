'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/currency';
import {
    RefreshCw,
    BookOpen,
    Search,
    ArrowRight,
    Calendar,
} from 'lucide-react';

interface Account {
    id: string;
    accountCode: string;
    accountName: string;
    accountType: string;
    currentBalance: string;
    normalBalance: string;
}

interface LedgerTransaction {
    line: {
        id: string;
        debitAmount: string;
        creditAmount: string;
        description: string;
    };
    entry: {
        id: string;
        entryNumber: string;
        entryDate: string;
        entryType: string;
        narration: string;
    };
}

export default function GeneralLedgerPage() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
    const [ledgerData, setLedgerData] = useState<{ account: Account; transactions: LedgerTransaction[] } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [ledgerLoading, setLedgerLoading] = useState(false);
    const [dateRange, setDateRange] = useState({
        dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        dateTo: new Date().toISOString().split('T')[0],
    });

    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        try {
            setLoading(true);
            const res = await apiClient.get('/accounting/accounts', {
                params: { search: searchQuery || undefined },
            });
            if (res.data.success) {
                setAccounts(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch accounts:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchLedger = async (accountId: string) => {
        try {
            setLedgerLoading(true);
            setSelectedAccount(accountId);
            const res = await apiClient.get(`/accounting/accounts/${accountId}/ledger`, {
                params: dateRange,
            });
            if (res.data.success) {
                setLedgerData(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch ledger:', err);
        } finally {
            setLedgerLoading(false);
        }
    };

    useEffect(() => {
        if (selectedAccount) {
            fetchLedger(selectedAccount);
        }
    }, [dateRange]);

    // Compute running balance from transactions
    const computeRunningBalance = (transactions: LedgerTransaction[], normalBalance: string) => {
        let running = 0;
        return transactions.reverse().map(t => {
            const debit = parseFloat(t.line.debitAmount || '0');
            const credit = parseFloat(t.line.creditAmount || '0');
            if (normalBalance === 'debit') {
                running += debit - credit;
            } else {
                running += credit - debit;
            }
            return { ...t, runningBalance: running };
        }).reverse();
    };

    const filteredAccounts = accounts.filter(a =>
        a.accountName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.accountCode.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getTypeColor = (type: string) => {
        const colors: Record<string, string> = {
            asset: 'bg-blue-100 text-blue-700',
            liability: 'bg-orange-100 text-orange-700',
            equity: 'bg-purple-100 text-purple-700',
            income: 'bg-green-100 text-green-700',
            expense: 'bg-red-100 text-red-700',
        };
        return colors[type] || 'bg-gray-100 text-gray-700';
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">General Ledger</h1>
                <p className="text-gray-500 mt-1">View transaction history for any account</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Account List */}
                <div className="lg:col-span-1">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <BookOpen className="h-5 w-5" />
                                Accounts
                            </CardTitle>
                            <div className="relative mt-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Search accounts..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="max-h-[600px] overflow-y-auto">
                                {loading ? (
                                    <div className="text-center py-8">
                                        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                                    </div>
                                ) : filteredAccounts.length > 0 ? (
                                    filteredAccounts.map(account => (
                                        <button
                                            key={account.id}
                                            onClick={() => fetchLedger(account.id)}
                                            className={`w-full text-left px-4 py-3 border-b hover:bg-gray-50 transition flex items-center justify-between ${selectedAccount === account.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                                                }`}
                                        >
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono text-gray-500">{account.accountCode}</span>
                                                    <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${getTypeColor(account.accountType)}`}>
                                                        {account.accountType}
                                                    </span>
                                                </div>
                                                <p className="font-medium text-sm mt-0.5">{account.accountName}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-medium">
                                                    {formatCurrency(parseFloat(account.currentBalance || '0'))}
                                                </p>
                                                <ArrowRight className="h-3 w-3 text-gray-400 ml-auto" />
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <p className="text-gray-400 text-center py-8">No accounts found</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Ledger View */}
                <div className="lg:col-span-2">
                    {selectedAccount && ledgerData ? (
                        <Card>
                            <CardHeader>
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                                    <div>
                                        <CardTitle className="text-lg">
                                            {ledgerData.account.accountCode} - {ledgerData.account.accountName}
                                        </CardTitle>
                                        <p className="text-sm text-gray-500 capitalize mt-0.5">
                                            {ledgerData.account.accountType} | Normal: {ledgerData.account.normalBalance}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-gray-400" />
                                        <Input
                                            type="date"
                                            value={dateRange.dateFrom}
                                            onChange={(e) => setDateRange(prev => ({ ...prev, dateFrom: e.target.value }))}
                                            className="w-32 text-sm"
                                        />
                                        <span className="text-gray-400">-</span>
                                        <Input
                                            type="date"
                                            value={dateRange.dateTo}
                                            onChange={(e) => setDateRange(prev => ({ ...prev, dateTo: e.target.value }))}
                                            className="w-32 text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                                    <p className="text-sm text-gray-500">Current Balance</p>
                                    <p className="text-2xl font-bold">
                                        {formatCurrency(parseFloat(ledgerData.account.currentBalance || '0'))}
                                    </p>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {ledgerLoading ? (
                                    <div className="text-center py-8">
                                        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                                    </div>
                                ) : ledgerData.transactions.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="text-left p-2">Date</th>
                                                    <th className="text-left p-2">Entry #</th>
                                                    <th className="text-left p-2">Description</th>
                                                    <th className="text-right p-2">Debit</th>
                                                    <th className="text-right p-2">Credit</th>
                                                    <th className="text-right p-2">Balance</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {computeRunningBalance(ledgerData.transactions, ledgerData.account.normalBalance).map((t, idx) => (
                                                    <tr key={t.line.id || idx} className="border-t hover:bg-gray-50">
                                                        <td className="p-2 whitespace-nowrap">
                                                            {new Date(t.entry.entryDate).toLocaleDateString()}
                                                        </td>
                                                        <td className="p-2 font-mono text-xs">{t.entry.entryNumber}</td>
                                                        <td className="p-2">
                                                            {t.line.description || t.entry.narration || '-'}
                                                        </td>
                                                        <td className="p-2 text-right">
                                                            {parseFloat(t.line.debitAmount || '0') > 0
                                                                ? formatCurrency(parseFloat(t.line.debitAmount))
                                                                : '-'}
                                                        </td>
                                                        <td className="p-2 text-right">
                                                            {parseFloat(t.line.creditAmount || '0') > 0
                                                                ? formatCurrency(parseFloat(t.line.creditAmount))
                                                                : '-'}
                                                        </td>
                                                        <td className="p-2 text-right font-medium">
                                                            {formatCurrency(t.runningBalance)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <BookOpen className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                                        <p className="text-gray-500">No transactions for this account in the selected period</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="p-12 text-center">
                            <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-lg font-medium text-gray-600">Select an account</p>
                            <p className="text-sm text-gray-400 mt-1">Choose an account from the list to view its transaction ledger</p>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
