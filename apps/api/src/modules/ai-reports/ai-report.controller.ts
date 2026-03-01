import { Request, Response } from 'express';
import { aiReportService } from './ai-report.service.js';
import { accountingService } from '../accounting/accounting.service.js';
import { goldLedgerService } from '../gold-ledger/gold-ledger.service.js';
import { logger } from '../../utils/logger.js';

interface AuthRequest extends Request {
    user?: {
        userId: string;
        storeId: string;
        email: string;
        permissions: string[];
    };
}

class AIReportController {
    // Check if Ollama is available
    async checkStatus(_req: AuthRequest, res: Response): Promise<void> {
        try {
            const status = await aiReportService.checkAvailability();
            res.json({ success: true, data: status });
        } catch (error: any) {
            logger.error('AI status check error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'AI_STATUS_CHECK_FAILED', message: 'Failed to check AI status' },
            });
        }
    }

    // Get available report types
    async getReportTypes(_req: AuthRequest, res: Response): Promise<void> {
        const types = aiReportService.getReportTypes();
        res.json({ success: true, data: types });
    }

    // Generate an AI analysis
    async generateReport(req: AuthRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
                });
                return;
            }

            const { prompt, reportType, includeData } = req.body;

            if (!prompt && !reportType) {
                res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'Either prompt or reportType is required' },
                });
                return;
            }

            // Determine what data to collect
            const dataToInclude = includeData || ['incomeStatement', 'goldPosition'];

            // Collect context data (pre-aggregated, safe summaries only)
            const contextData: Record<string, any> = {};

            const today = new Date().toISOString().split('T')[0];
            const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                .toISOString().split('T')[0];

            try {
                if (dataToInclude.includes('incomeStatement')) {
                    contextData.incomeStatement = await accountingService.getIncomeStatement(
                        req.user.storeId, firstOfMonth, today
                    );
                }
            } catch { /* non-critical */ }

            try {
                if (dataToInclude.includes('balanceSheet')) {
                    contextData.balanceSheet = await accountingService.getBalanceSheet(req.user.storeId, today);
                }
            } catch { /* non-critical */ }

            try {
                if (dataToInclude.includes('trialBalance')) {
                    contextData.trialBalance = await accountingService.getTrialBalance(req.user.storeId, today);
                }
            } catch { /* non-critical */ }

            try {
                if (dataToInclude.includes('cashFlow')) {
                    contextData.cashFlow = await accountingService.getCashFlowStatement(
                        req.user.storeId, firstOfMonth, today
                    );
                }
            } catch { /* non-critical */ }

            try {
                if (dataToInclude.includes('goldPosition')) {
                    contextData.goldPosition = await goldLedgerService.getGoldPosition(req.user.storeId);
                }
            } catch { /* non-critical */ }

            // Determine final prompt
            let finalPrompt = prompt;
            if (reportType && !prompt) {
                const types = aiReportService.getReportTypes();
                const selectedType = types.find(t => t.id === reportType);
                if (selectedType) {
                    finalPrompt = selectedType.prompt;
                }
            }

            if (!finalPrompt) {
                res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'Could not determine analysis prompt' },
                });
                return;
            }

            // Generate analysis
            const result = await aiReportService.generateAnalysis(finalPrompt, contextData);

            if (result.success) {
                res.json({
                    success: true,
                    data: {
                        analysis: result.analysis,
                        dataUsed: Object.keys(contextData),
                        generatedAt: new Date().toISOString(),
                    },
                });
            } else {
                res.status(503).json({
                    success: false,
                    error: {
                        code: 'AI_GENERATION_FAILED',
                        message: result.error,
                    },
                });
            }
        } catch (error: any) {
            logger.error('AI report generation error:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'AI_REPORT_FAILED',
                    message: 'Failed to generate AI report',
                },
            });
        }
    }
}

export const aiReportController = new AIReportController();
