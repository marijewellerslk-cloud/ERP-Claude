import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { getNotificationStatus } from './notifications.controller';
import { emailService } from '../../services/email.service';
import { whatsappService } from '../../services/whatsapp.service';

// Mock the services
vi.mock('../../services/email.service', () => ({
    emailService: {
        isConfigured: vi.fn(),
    },
}));

vi.mock('../../services/whatsapp.service', () => ({
    whatsappService: {
        isConfigured: vi.fn(),
    },
}));

describe('Notifications Controller', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let jsonMock: any;

    beforeEach(() => {
        mockReq = {};
        jsonMock = vi.fn();
        mockRes = {
            json: jsonMock,
            status: vi.fn().mockReturnThis(),
        };
    });

    it('should return configured: true when services are configured', async () => {
        (emailService.isConfigured as any).mockReturnValue(true);
        (whatsappService.isConfigured as any).mockReturnValue(true);

        await getNotificationStatus(mockReq as Request, mockRes as Response);

        expect(jsonMock).toHaveBeenCalledWith({
            success: true,
            data: {
                email: {
                    configured: true,
                    provider: 'SMTP',
                },
                whatsapp: {
                    configured: true,
                    provider: 'Green API',
                },
            },
        });
    });

    it('should return configured: false when services are not configured', async () => {
        (emailService.isConfigured as any).mockReturnValue(false);
        (whatsappService.isConfigured as any).mockReturnValue(false);

        await getNotificationStatus(mockReq as Request, mockRes as Response);

        expect(jsonMock).toHaveBeenCalledWith({
            success: true,
            data: {
                email: {
                    configured: false,
                    provider: 'SMTP',
                },
                whatsapp: {
                    configured: false,
                    provider: 'Green API',
                },
            },
        });
    });

    it('should handle errors gracefully', async () => {
        (emailService.isConfigured as any).mockImplementation(() => {
            throw new Error('Something went wrong');
        });

        await getNotificationStatus(mockReq as Request, mockRes as Response);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to retrieve notification status',
            },
        });
    });
});
