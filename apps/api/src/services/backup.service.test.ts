import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BackupService } from './backup.service';
import { promises as fsPromises } from 'node:fs';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

// Mock dependencies
vi.mock('node:fs', () => ({
    promises: {
        mkdir: vi.fn(),
        stat: vi.fn(),
        unlink: vi.fn(),
        readdir: vi.fn(),
        readFile: vi.fn(),
    },
    createReadStream: vi.fn(),
    createWriteStream: vi.fn(),
}));
vi.mock('node:child_process');
vi.mock('../config/database', () => ({
    db: {
        execute: vi.fn(),
    },
}));
vi.mock('../utils/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
    },
}));

describe('BackupService', () => {
    let backupService: BackupService;
    const mockConfig = {
        retentionDays: 30,
        backupDir: './test-backups',
        compress: false,
        uploadToCloud: false,
        cloudBucket: 'test-bucket',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        backupService = new BackupService(mockConfig);
    });

    describe('createBackup', () => {
        it('should successfully create a backup', async () => {
            // Mock fs.mkdir
            vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);

            // Mock pg_dump process
            const mockProcess = new EventEmitter() as any;
            mockProcess.stdout = new EventEmitter();
            mockProcess.stderr = new EventEmitter();
            vi.mocked(spawn).mockReturnValue(mockProcess);

            // Mock fs.stat
            vi.mocked(fsPromises.stat).mockResolvedValue({ size: 1024, birthtime: new Date() } as any);

            const backupPromise = backupService.createBackup('full');

            // Simulate successful process completion
            setTimeout(() => {
                mockProcess.emit('close', 0);
            }, 10);

            const result = await backupPromise;

            if (!result.success) {
                console.error('Backup failed with error:', result.error);
            }

            expect(result.success).toBe(true);
            expect(result.fileSize).toBe(1024);
            expect(fsPromises.mkdir).toHaveBeenCalledWith(mockConfig.backupDir, { recursive: true });
            expect(spawn).toHaveBeenCalledWith('pg_dump', expect.arrayContaining(['--format', 'custom']));
        });

        it('should handle backup creation failure', async () => {
            // Mock fs.mkdir
            vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);

            // Mock pg_dump process
            const mockProcess = new EventEmitter() as any;
            mockProcess.stdout = new EventEmitter();
            mockProcess.stderr = new EventEmitter();
            vi.mocked(spawn).mockReturnValue(mockProcess);

            const backupPromise = backupService.createBackup('full');

            // Simulate failure
            setTimeout(() => {
                mockProcess.stderr.emit('data', 'Mock error');
                mockProcess.emit('close', 1);
            }, 10);

            const result = await backupPromise;

            expect(result.success).toBe(false);
            expect(result.error).toContain('pg_dump failed with exit code 1');
        });
    });
});
