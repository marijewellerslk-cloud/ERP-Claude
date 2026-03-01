import { Request, Response } from 'express';
import { storageService } from '../../services/storage.service.js';
import { logger } from '../../utils/logger.js';

export class UploadController {
    async uploadImage(req: Request, res: Response) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No file uploaded',
                });
            }

            const file = req.file;
            const folder = req.body.folder || 'misc';

            // Validate mime type
            if (!file.mimetype.startsWith('image/')) {
                return res.status(400).json({
                    success: false,
                    error: 'Only image files are allowed',
                });
            }

            const fileUrl = await storageService.uploadFile(file, folder);

            res.status(201).json({
                success: true,
                data: {
                    url: fileUrl,
                    fileName: file.originalname,
                    size: file.size,
                    mimetype: file.mimetype,
                },
            });
        } catch (error: any) {
            logger.error('Upload error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to upload file',
            });
        }
    }
}

export const uploadController = new UploadController();
