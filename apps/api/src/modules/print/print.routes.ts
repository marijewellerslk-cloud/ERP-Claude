/**
 * Print Routes — Send ZPL/raw data to local printers via CUPS `lp` command
 * Works on macOS and Linux systems with CUPS installed
 */
import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const router = Router();

/**
 * GET /api/v1/print/printers
 * List available printers (via lpstat)
 */
router.get('/printers', async (_req: Request, res: Response) => {
    try {
        const printers = await new Promise<string[]>((resolve) => {
            exec('lpstat -p 2>/dev/null', (error, stdout) => {
                if (error) {
                    // No printers or lpstat not available
                    resolve([]);
                    return;
                }
                const printerNames = stdout
                    .split('\n')
                    .filter((line) => line.startsWith('printer '))
                    .map((line) => {
                        const parts = line.split(' ');
                        return parts[1]; // printer name
                    });
                resolve(printerNames);
            });
        });

        res.json({ success: true, data: printers });
    } catch {
        res.status(500).json({ success: false, error: { message: 'Failed to list printers' } });
    }
});

/**
 * POST /api/v1/print/zpl
 * Send ZPL data to a Zebra printer via CUPS lp command
 *
 * Body: { zpl: string, printerName?: string }
 */
router.post('/zpl', async (req: Request, res: Response) => {
    try {
        const { zpl, printerName } = req.body;

        if (!zpl || typeof zpl !== 'string') {
            res.status(400).json({
                success: false,
                error: { message: 'ZPL data is required' },
            });
            return;
        }

        // Auto-detect Zebra printer if not specified
        let printer = printerName;
        if (!printer) {
            printer = await new Promise<string | null>((resolve) => {
                exec('lpstat -p 2>/dev/null', (error, stdout) => {
                    if (error) {
                        resolve(null);
                        return;
                    }
                    // Look for Zebra printer
                    const zebraLine = stdout
                        .split('\n')
                        .find((line) => line.toLowerCase().includes('zebra'));
                    if (zebraLine) {
                        resolve(zebraLine.split(' ')[1]);
                    } else {
                        resolve(null);
                    }
                });
            });
        }

        if (!printer) {
            res.status(400).json({
                success: false,
                error: {
                    message: 'No Zebra printer found. Please connect the printer and try again.',
                },
            });
            return;
        }

        // Write ZPL to a temp file (lp reads from file)
        const tmpFile = join(tmpdir(), `zpl_${randomUUID()}.zpl`);
        await writeFile(tmpFile, zpl, 'utf-8');

        // Send to printer using lp with raw option
        await new Promise<void>((resolve, reject) => {
            exec(`lp -d "${printer}" -o raw "${tmpFile}"`, (error, _stdout, stderr) => {
                // Clean up temp file regardless
                unlink(tmpFile).catch(() => { });

                if (error) {
                    reject(new Error(stderr || error.message));
                    return;
                }
                resolve();
            });
        });

        res.json({
            success: true,
            data: {
                message: `Labels sent to printer: ${printer}`,
                printer,
            },
        });
    } catch (err: any) {
        res.status(500).json({
            success: false,
            error: { message: err.message || 'Failed to print' },
        });
    }
});

export default router;
