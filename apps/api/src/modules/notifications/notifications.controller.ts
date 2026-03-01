import { Request, Response } from 'express';
import { emailService } from '../../services/email.service.js';
import { whatsappService } from '../../services/whatsapp.service.js';

export const getNotificationStatus = async (req: Request, res: Response) => {
    try {
        const emailConfigured = emailService.isConfigured();
        const whatsappConfigured = whatsappService.isConfigured();

        res.json({
            success: true,
            data: {
                email: {
                    configured: emailConfigured,
                    provider: 'SMTP', // Hardcoded for now as we only support SMTP
                },
                whatsapp: {
                    configured: whatsappConfigured,
                    provider: 'Green API', // Hardcoded as per service
                },
            },
        });
    } catch (error) {
        console.error('Error getting notification status:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to retrieve notification status',
            },
        });
    }
};
