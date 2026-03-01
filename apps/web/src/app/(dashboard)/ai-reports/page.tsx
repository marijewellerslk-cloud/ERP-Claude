'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import apiClient from '@/lib/api-client';
import {
    RefreshCw,
    Bot,
    Send,
    CheckCircle,
    XCircle,
    Sparkles,
    FileText,
    Coins,
    BarChart3,
    Zap,
} from 'lucide-react';

interface ReportType {
    id: string;
    name: string;
    description: string;
    prompt: string;
    requiredData: string[];
}

interface AIStatus {
    available: boolean;
    models: string[];
}

export default function AIReportsPage() {
    const [status, setStatus] = useState<AIStatus | null>(null);
    const [reportTypes, setReportTypes] = useState<ReportType[]>([]);
    const [selectedType, setSelectedType] = useState<string>('');
    const [customPrompt, setCustomPrompt] = useState('');
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [dataUsed, setDataUsed] = useState<string[]>([]);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        setLoading(true);
        try {
            const [statusRes, typesRes] = await Promise.all([
                apiClient.get('/ai-reports/status'),
                apiClient.get('/ai-reports/report-types'),
            ]);

            if (statusRes.data.success) setStatus(statusRes.data.data);
            if (typesRes.data.success) setReportTypes(typesRes.data.data);
        } catch (err) {
            console.error('Failed to check AI status:', err);
        } finally {
            setLoading(false);
        }
    };

    const generateReport = async () => {
        setGenerating(true);
        setError(null);
        setAnalysis(null);

        try {
            const selected = reportTypes.find(t => t.id === selectedType);
            const isCustom = selectedType === 'custom';

            const payload: any = {
                reportType: isCustom ? undefined : selectedType,
                prompt: isCustom ? customPrompt : selected?.prompt,
                includeData: isCustom
                    ? ['incomeStatement', 'balanceSheet', 'goldPosition', 'cashFlow']
                    : selected?.requiredData,
            };

            const res = await apiClient.post('/ai-reports/generate', payload);

            if (res.data.success) {
                setAnalysis(res.data.data.analysis);
                setDataUsed(res.data.data.dataUsed || []);
            } else {
                setError(res.data.error?.message || 'Failed to generate report');
            }
        } catch (err: any) {
            setError(err.response?.data?.error?.message || 'Failed to connect to AI service');
        } finally {
            setGenerating(false);
        }
    };

    const getTypeIcon = (id: string) => {
        switch (id) {
            case 'financial-health': return BarChart3;
            case 'gold-position': return Coins;
            case 'daily-briefing': return Zap;
            default: return FileText;
        }
    };

    if (loading) {
        return (
            <div className="text-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                <p className="text-gray-500 mt-2">Checking AI service...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Bot className="h-8 w-8 text-purple-600" />
                        AI Reports
                    </h1>
                    <p className="text-gray-500 mt-1">
                        AI-powered financial analysis using your business data
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {status?.available ? (
                        <Badge className="bg-green-100 text-green-700 gap-1 py-1">
                            <CheckCircle className="h-3 w-3" />
                            Ollama Connected
                        </Badge>
                    ) : (
                        <Badge className="bg-red-100 text-red-700 gap-1 py-1">
                            <XCircle className="h-3 w-3" />
                            Ollama Offline
                        </Badge>
                    )}
                    <Button onClick={checkStatus} variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {!status?.available && (
                <Card className="p-6 bg-amber-50 border-amber-200">
                    <div className="flex items-start gap-3">
                        <Bot className="h-6 w-6 text-amber-600 mt-0.5" />
                        <div>
                            <p className="font-medium text-amber-800">Ollama is not running</p>
                            <p className="text-sm text-amber-700 mt-1">
                                To use AI reports, install and start Ollama on this machine:
                            </p>
                            <ol className="text-sm text-amber-700 mt-2 list-decimal list-inside space-y-1">
                                <li>Install Ollama: <code className="bg-amber-100 px-1 rounded">brew install ollama</code></li>
                                <li>Start the service: <code className="bg-amber-100 px-1 rounded">ollama serve</code></li>
                                <li>Pull a model: <code className="bg-amber-100 px-1 rounded">ollama pull llama3.2</code></li>
                            </ol>
                        </div>
                    </div>
                </Card>
            )}

            {/* Report type selection */}
            <div>
                <h2 className="text-lg font-semibold mb-3">Choose Analysis Type</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {reportTypes.map(type => {
                        const Icon = getTypeIcon(type.id);
                        const isSelected = selectedType === type.id;
                        return (
                            <Card
                                key={type.id}
                                className={`p-4 cursor-pointer transition hover:shadow-md ${isSelected ? 'ring-2 ring-purple-500 bg-purple-50' : ''
                                    }`}
                                onClick={() => setSelectedType(type.id)}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <Icon className={`h-5 w-5 ${isSelected ? 'text-purple-600' : 'text-gray-400'}`} />
                                    <p className="font-medium text-sm">{type.name}</p>
                                </div>
                                <p className="text-xs text-gray-500">{type.description}</p>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* Custom prompt */}
            {selectedType === 'custom' && (
                <Card className="p-4">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                        Your Question
                    </label>
                    <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="e.g., How did gold sales perform this month compared to the previous month?"
                        className="w-full border rounded-lg p-3 text-sm min-h-[100px] focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                </Card>
            )}

            {/* Generate button */}
            <div className="flex items-center gap-4">
                <Button
                    onClick={generateReport}
                    disabled={!selectedType || generating || !status?.available || (selectedType === 'custom' && !customPrompt.trim())}
                    className="bg-purple-600 hover:bg-purple-700"
                >
                    {generating ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                        <Send className="h-4 w-4 mr-2" />
                    )}
                    {generating ? 'Generating...' : 'Generate Analysis'}
                </Button>

                {generating && (
                    <p className="text-sm text-gray-500 animate-pulse">
                        AI is analyzing your business data...
                    </p>
                )}
            </div>

            {error && (
                <Card className="p-4 bg-red-50 border-red-200">
                    <p className="text-red-600 text-sm">{error}</p>
                </Card>
            )}

            {/* Analysis result */}
            {analysis && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-purple-600" />
                            AI Analysis
                        </CardTitle>
                        {dataUsed.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap mt-2">
                                <span className="text-xs text-gray-500">Data sources:</span>
                                {dataUsed.map(d => (
                                    <Badge key={d} variant="secondary" className="text-xs capitalize">
                                        {d.replace(/([A-Z])/g, ' $1').trim()}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </CardHeader>
                    <CardContent>
                        <div className="prose prose-sm max-w-none">
                            <div
                                className="whitespace-pre-wrap text-gray-700 leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: formatMarkdown(analysis) }}
                            />
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

// Simple markdown-to-HTML formatter for LLM output
function formatMarkdown(text: string): string {
    return text
        .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
        .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
        .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-3">$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/^- (.+)$/gm, '<li class="ml-4">• $1</li>')
        .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4">$1. $2</li>')
        .replace(/\n/g, '<br />');
}
