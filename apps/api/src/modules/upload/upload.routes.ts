import { Router } from 'express';
import multer from 'multer';
import { uploadController } from './upload.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    }
});

// All upload routes require authentication
router.use(authenticate);

router.post(
    '/image',
    upload.single('file'), // Expects form field name 'file'
    (req, res) => uploadController.uploadImage(req, res)
);

export default router;
