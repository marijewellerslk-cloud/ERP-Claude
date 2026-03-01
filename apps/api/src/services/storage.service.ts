import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { logger } from '../utils/logger.js';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

export class StorageService {
    private s3Client: S3Client | null = null;
    private bucketName: string;
    private useCloud: boolean;

    constructor() {
        this.bucketName = process.env.Backup_BUCKET || 'erp-uploads'; // Using Backup_BUCKET env var from backup service context or a new one
        this.useCloud = process.env.BACKUP_UPLOAD_TO_CLOUD === 'true'; // Reusing existing env logic or creating new

        if (this.useCloud) {
            // Initialize S3 Client
            this.s3Client = new S3Client({
                region: process.env.BACKUP_AWS_REGION || 'us-east-1',
                endpoint: process.env.BACKUP_S3_ENDPOINT,
                credentials: {
                    accessKeyId: process.env.BACKUP_AWS_ACCESS_KEY_ID || '',
                    secretAccessKey: process.env.BACKUP_AWS_SECRET_ACCESS_KEY || '',
                },
                forcePathStyle: true, // For MinIO
            });
        }
    }

    /**
     * Uploads a file to storage (Cloud or Local)
     */
    async uploadFile(file: Express.Multer.File, folder: string = 'uploads'): Promise<string> {
        const fileExtension = path.extname(file.originalname);
        const fileName = `${folder}/${uuidv4()}${fileExtension}`;

        if (this.useCloud && this.s3Client) {
            try {
                const upload = new Upload({
                    client: this.s3Client,
                    params: {
                        Bucket: this.bucketName,
                        Key: fileName,
                        Body: file.buffer,
                        ContentType: file.mimetype,
                        // ACL: 'public-read', // Depends on bucket policy
                    },
                });

                await upload.done();

                // Return public URL (assuming public bucket or presigned)
                // For MinIO/S3, constructing the URL manually or using the endpoint
                const endpoint = process.env.BACKUP_S3_ENDPOINT || '';
                return `${endpoint}/${this.bucketName}/${fileName}`;
            } catch (error) {
                logger.error('S3 Upload Error:', error);
                throw new Error('Failed to upload file to cloud storage');
            }
        } else {
            // Local Storage Fallback
            const uploadDir = path.join(process.cwd(), 'public', folder);

            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const filePath = path.join(uploadDir, path.basename(fileName)); // fileName includes folder, need just basename or full path logic
            // Actually fileName is 'folder/uuid.ext'. 
            // We want path.join(process.cwd(), 'public', fileName)

            const fullPath = path.join(process.cwd(), 'public', fileName);
            const dir = path.dirname(fullPath);

            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(fullPath, file.buffer);

            // Return relative URL for frontend
            return `/api/static/${fileName}`; // Need to serve static files from express
        }
    }

    /**
     * Deletes a file from storage
     */
    async deleteFile(fileUrl: string): Promise<void> {
        // Extract key from URL
        // TODO: Implement robust key extraction
        const key = fileUrl.split(`${this.bucketName}/`).pop();

        if (this.useCloud && this.s3Client && key) {
            try {
                await this.s3Client.send(new DeleteObjectCommand({
                    Bucket: this.bucketName,
                    Key: key,
                }));
            } catch (error) {
                logger.error('S3 Delete Error:', error);
                // Don't throw, just log
            }
        } else {
            // Local delete logic
        }
    }
}

export const storageService = new StorageService();
