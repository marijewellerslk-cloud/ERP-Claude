'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import apiClient from '@/lib/api-client';
import {
    RefreshCw,
    Shield,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Banknote,
    AlertOctagon,
    Eye,
    Wallet,
} from 'lucide-react';

export default function FraudRiskPage() {
    const [loading, setLoading] = useState(true);
    const [riskScores, setRiskScores] = useState<any[]>([]);
    const [anomalies, setAnomalies] = useState<any[]>([]);
    const [cashForecast, setCashForecast] = useState<any>(null);
    const [loanRisks, setLoanRisks] = useState<any[]>([]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [scoreRes, anomalyRes, cashRes, loanRes] = await Promise.allSettled([
                apiClient.get('/command-center/fraud/risk-score'),
                apiClient.get('/command-center/fraud/anomalies'),
                apiClient.get('/command-center/fraud/cash-forecast'),
                apiClient.get('/command-center/fraud/loan-risk'),
            ]);

            if (scoreRes.status === 'fulfilled') setRiskScores(scoreRes.value.data?.data || []);
            if (anomalyRes.status === 'fulfilled') setAnomalies(anomalyRes.value.data?.data || []);
            if (cashRes.status === 'fulfilled') setCashForecast(cashRes.value.data?.data || null);
            if (loanRes.status === 'fulfilled') setLoanRisks(loanRes.value.data?.data || []);
        } catch (err) {
            console.error('Failed to fetch fraud data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(val);

    const getSeverityColor = (s: string) => {
        switch (s) {
            case 'critical': return 'bg-red-100 text-red-800 border-red-200';
            case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            default: return 'bg-green-100 text-green-800 border-green-200';
        }
    };

    const getRiskScoreColor = (score: number) => {
        if (score >= 60) return 'text-red-600';
        if (score >= 40) return 'text-orange-600';
        if (score >= 20) return 'text-yellow-600';
        return 'text-green-600';
    };

    if (loading) {
        return (
            <div className="text-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                <p className="text-gray-500 mt-2">Analyzing risk signals...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Shield className="h-8 w-8 text-red-600" />
                        Fraud & Risk Monitor
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Automated anomaly detection and risk assessment
                    </p>
                </div>
                <Button onClick={fetchData} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Store Risk Scores */}
            {riskScores.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {riskScores.map((store: any) => (
                        <Card key={store.storeId} className="p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <p className="font-medium">{store.storeName}</p>
                                    <p className="text-xs text-gray-500">{store.storeCode}</p>
                                </div>
                                <div className="text-right">
                                    <p className={`text-3xl font-bold ${getRiskScoreColor(store.riskScore)}`}>
                                        {store.riskScore}
                                    </p>
                                    <Badge className={getSeverityColor(store.riskLevel)}>
                                        {store.riskLevel}
                                    </Badge>
                                </div>
                            </div>
                            <div className="space-y-1">
                                {store.signals.map((s: any, i: number) => (
                                    <div key={i} className="flex items-center gap-2 text-xs">
                                        <span className={`w-2 h-2 rounded-full ${s.triggered ? 'bg-red-500' : 'bg-green-500'}`} />
                                        <span className={s.triggered ? 'text-red-700 font-medium' : 'text-gray-500'}>{s.signal}</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Anomaly Alerts */}
            {anomalies.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <AlertOctagon className="h-5 w-5 text-red-500" />
                            Anomaly Alerts
                            <Badge variant="destructive" className="ml-2">{anomalies.length}</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {anomalies.map((alert: any, i: number) => (
                                <div
                                    key={i}
                                    className={`p-3 rounded-lg border ${getSeverityColor(alert.severity)}`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle className="h-4 w-4" />
                                                <span className="font-medium text-sm">{alert.message}</span>
                                            </div>
                                            <p className="text-xs mt-1 opacity-80">{alert.storeName} · Type: {alert.type.replace(/_/g, ' ')}</p>
                                        </div>
                                        <Badge className={getSeverityColor(alert.severity)}>
                                            {alert.severity}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {anomalies.length === 0 && (
                <Card className="p-8 text-center bg-green-50 border-green-200">
                    <Shield className="h-12 w-12 mx-auto text-green-500 mb-3" />
                    <p className="text-green-700 font-medium">No anomalies detected</p>
                    <p className="text-sm text-green-600 mt-1">All transactions appear normal in the last 30 days</p>
                </Card>
            )}

            {/* Cash Flow Forecast + Loan Risks */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cash Flow */}
                {cashForecast && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Wallet className="h-5 w-5 text-blue-500" />
                                30-Day Cash Forecast
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-green-50 rounded-lg">
                                        <p className="text-xs text-gray-500">Current Liquidity</p>
                                        <p className="text-lg font-bold text-green-700">
                                            {formatCurrency(cashForecast.currentPosition?.totalLiquidity || 0)}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            Cash: {formatCurrency(cashForecast.currentPosition?.cashBalance || 0)} · Bank: {formatCurrency(cashForecast.currentPosition?.bankBalance || 0)}
                                        </p>
                                    </div>
                                    <div className={`p-3 rounded-lg ${cashForecast.forecast?.riskLevel === 'critical' ? 'bg-red-50' :
                                            cashForecast.forecast?.riskLevel === 'high' ? 'bg-orange-50' : 'bg-blue-50'
                                        }`}>
                                        <p className="text-xs text-gray-500">Projected (30 Days)</p>
                                        <p className={`text-lg font-bold ${cashForecast.forecast?.projected30DayBalance >= 0 ? 'text-green-700' : 'text-red-700'
                                            }`}>
                                            {formatCurrency(cashForecast.forecast?.projected30DayBalance || 0)}
                                        </p>
                                        <Badge className={getSeverityColor(cashForecast.forecast?.riskLevel || 'low')}>
                                            {cashForecast.forecast?.riskLevel} risk
                                        </Badge>
                                    </div>
                                </div>

                                <div className="border-t pt-3 space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Avg Daily Income</span>
                                        <span className="text-green-600 flex items-center gap-1">
                                            <TrendingUp className="h-3 w-3" />
                                            {formatCurrency(cashForecast.inflows?.avgDailyIncome || 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Avg Daily Expenses</span>
                                        <span className="text-red-600 flex items-center gap-1">
                                            <TrendingDown className="h-3 w-3" />
                                            {formatCurrency(cashForecast.outflows?.avgDailyExpenses || 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Payroll Due</span>
                                        <span>{formatCurrency(cashForecast.obligations?.payrollDue || 0)} ({cashForecast.obligations?.payrollEmployees || 0} employees)</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Expiring Loans</span>
                                        <span>{cashForecast.obligations?.expiringLoans || 0} loans · {formatCurrency(cashForecast.obligations?.expiringLoanAmount || 0)}</span>
                                    </div>
                                    {cashForecast.forecast?.daysUntilShortfall && (
                                        <div className="flex justify-between font-medium text-red-600">
                                            <span>Days Until Shortfall</span>
                                            <span>{cashForecast.forecast.daysUntilShortfall} days</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Loan Risk */}
                {loanRisks.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Banknote className="h-5 w-5 text-orange-500" />
                                At-Risk Loans
                                <Badge variant="destructive" className="ml-2">{loanRisks.length}</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {loanRisks.map((loan: any) => (
                                    <div
                                        key={loan.loanId}
                                        className={`p-3 rounded-lg border ${getSeverityColor(loan.riskLevel)}`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-medium text-sm">{loan.loanNumber}</p>
                                                <p className="text-xs opacity-80">{loan.customerName} · {loan.storeName}</p>
                                            </div>
                                            <Badge className={getSeverityColor(loan.riskLevel)}>
                                                LTV: {loan.currentLTV}%
                                            </Badge>
                                        </div>
                                        <div className="flex justify-between mt-2 text-xs">
                                            <span>Loan: {formatCurrency(loan.loanAmount)}</span>
                                            <span>Pledge Value: {formatCurrency(loan.pledgeValue)}</span>
                                            {loan.isExpired ? (
                                                <span className="text-red-600 font-bold">EXPIRED</span>
                                            ) : loan.daysToExpiry !== null ? (
                                                <span>{loan.daysToExpiry}d to expiry</span>
                                            ) : null}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {loanRisks.length === 0 && !cashForecast && (
                    <Card className="p-8 text-center">
                        <Eye className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500">Financial risk data will appear once there are active loans and financial records.</p>
                    </Card>
                )}
            </div>
        </div>
    );
}
