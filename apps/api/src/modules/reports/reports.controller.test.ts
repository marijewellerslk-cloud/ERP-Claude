
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { ReportsController } from './reports.controller.js';
import { marginReportsService } from '../../services/margin-reports.service.js';
import { stockValuationService } from '../../services/stock-valuation.service.js';
import { dailySummaryService } from '../../services/daily-summary.service.js';

// Mock the services
vi.mock('../../services/margin-reports.service.js', () => ({
    marginReportsService: {
        getDashboardMetrics: vi.fn(),
        getMarginAnalysis: vi.fn(),
        getCategoryPerformance: vi.fn(),
        getSalespersonPerformance: vi.fn(),
        getMetalProfitLoss: vi.fn(),
        getROIRanking: vi.fn(),
        getSlowMovingItems: vi.fn(),
    },
}));

vi.mock('../../services/stock-valuation.service.js', () => ({
    stockValuationService: {
        getStockAgingReport: vi.fn(),
        getValuationSummary: vi.fn(),
        revalueInventory: vi.fn(),
    },
}));

vi.mock('../../services/daily-summary.service.js', () => ({
    dailySummaryService: {
        getDailySummary: vi.fn(),
        getSummariesInRange: vi.fn(),
    },
}));


describe('ReportsController', () => {
    let controller: ReportsController;
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let jsonMock: any;
    let statusMock: any;

    beforeEach(() => {
        controller = new ReportsController();
        jsonMock = vi.fn();
        statusMock = vi.fn().mockReturnValue({ json: jsonMock });
        mockRes = {
            json: jsonMock,
            status: statusMock,
        } as unknown as Response;
        mockReq = {
            user: {
                storeId: 'test-store-id',
                permissions: ['*:*'],
            },
            query: {},
            body: {},
        } as unknown as Request;
    });

    describe('getDashboardMetrics', () => {
        it('should return dashboard metrics successfully', async () => {
            const mockMetrics = { today: { sales: 100 } };
            (marginReportsService.getDashboardMetrics as any).mockResolvedValue(mockMetrics);

            await controller.getDashboardMetrics(mockReq as Request, mockRes as Response);

            expect(marginReportsService.getDashboardMetrics).toHaveBeenCalledWith('test-store-id');
            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                data: mockMetrics,
            });
        });
    });

    describe('getMarginAnalysis', () => {
        it('should return margin analysis successfully', async () => {
            mockReq.query = { startDate: '2023-01-01', endDate: '2023-01-31' };
            const mockAnalysis = [{ itemId: '1', grossMarginPercent: 20 }];
            (marginReportsService.getMarginAnalysis as any).mockResolvedValue(mockAnalysis);

            await controller.getMarginAnalysis(mockReq as Request, mockRes as Response);

            expect(marginReportsService.getMarginAnalysis).toHaveBeenCalled();
            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                data: mockAnalysis,
            });
        });

        it('should return 400 if dates are missing', async () => {
            mockReq.query = {};
            await controller.getMarginAnalysis(mockReq as Request, mockRes as Response);
            expect(statusMock).toHaveBeenCalledWith(400);
        });
    });

    describe('getValuationSummary', () => {
        it('should return valuation summary successfully', async () => {
            const mockSummary = { totalValue: 50000 };
            (stockValuationService.getValuationSummary as any).mockResolvedValue(mockSummary);

            await controller.getValuationSummary(mockReq as Request, mockRes as Response);

            expect(stockValuationService.getValuationSummary).toHaveBeenCalledWith('test-store-id');
            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                data: mockSummary,
            });
        });
    });

    describe('triggerRevaluation', () => {
        it('should trigger revaluation successfully', async () => {
            const mockResult = { itemsRevalued: 5 };
            (stockValuationService.revalueInventory as any).mockResolvedValue(mockResult);

            await controller.triggerRevaluation(mockReq as Request, mockRes as Response);

            expect(stockValuationService.revalueInventory).toHaveBeenCalledWith('test-store-id');
            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                data: mockResult,
                message: 'Revalued 5 items',
            });
        });
    });

    describe('getStockAgingReport', () => {
        it('should return stock aging report successfully', async () => {
            const mockReport = { buckets: [] };
            (stockValuationService.getStockAgingReport as any).mockResolvedValue(mockReport);

            await controller.getStockAgingReport(mockReq as Request, mockRes as Response);

            expect(stockValuationService.getStockAgingReport).toHaveBeenCalledWith('test-store-id', 180);
            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                data: mockReport,
            });
        });
    });
});
