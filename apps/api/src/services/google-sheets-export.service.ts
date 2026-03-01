/**
 * Google Sheets Export & DB Recovery Service
 *
 * Two responsibilities:
 * 1. Push daily snapshots to Google Sheets (export)
 * 2. Restore database from Google Sheets data (disaster recovery)
 *
 * Requires env vars:
 *   GOOGLE_SERVICE_ACCOUNT_KEY — JSON string of service account credentials
 *   GOOGLE_SHEET_ID — Spreadsheet ID to push snapshots to
 */

import { google, sheets_v4 } from 'googleapis';
import { db } from '../config/database.js';
import {
    customers,
    inventoryItems,
    invoices,
    invoiceItems,
    payments,
    goldLoans,
    pledgedGold,
    loanPayments,
    journalEntries,
    journalEntryLines,
    stores,
} from '../db/schema.js';
import { sql, eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { sheetsToRows } from './excel-export.service.js';
import type { SheetData } from './excel-export.service.js';

// ============================================================================
// TYPES
// ============================================================================

interface RestoreOptions {
    spreadsheetId?: string;
    sheetDate?: string; // e.g. '16-02-2026'
    dryRun?: boolean;
    force?: boolean; // skip safety check for existing data
}

interface RestoreResult {
    success: boolean;
    dryRun: boolean;
    tables: { tableName: string; rowCount: number; status: string }[];
    errors: string[];
}

// ============================================================================
// GOOGLE SHEETS CLIENT
// ============================================================================

class GoogleSheetsExportService {
    private sheetsApi: sheets_v4.Sheets | null = null;
    private spreadsheetId: string;
    private initialized = false;

    constructor() {
        this.spreadsheetId = process.env.GOOGLE_SHEET_ID || '';
    }

    /**
     * Initialize the Google Sheets API client.
     * Returns false if credentials are not configured.
     */
    private async init(): Promise<boolean> {
        if (this.initialized) return this.sheetsApi !== null;

        this.initialized = true;

        const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        if (!keyJson || !this.spreadsheetId) {
            logger.warn(
                'Google Sheets not configured. Set GOOGLE_SERVICE_ACCOUNT_KEY and GOOGLE_SHEET_ID env vars.'
            );
            return false;
        }

        try {
            const credentials = JSON.parse(keyJson);
            const auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });

            this.sheetsApi = google.sheets({ version: 'v4', auth });
            logger.info('Google Sheets API initialized successfully');
            return true;
        } catch (error) {
            logger.error('Failed to initialize Google Sheets API', { error });
            return false;
        }
    }

    // ==========================================================================
    // EXPORT (PUSH TO SHEETS)
    // ==========================================================================

    /**
     * Push snapshot data to Google Sheets.
     * Creates/overwrites a tab for each sheet with the date prefix.
     */
    async pushToSheets(
        allSheets: SheetData[],
        dateLabel: string
    ): Promise<{ success: boolean; sheetsUpdated: string[] }> {
        const ready = await this.init();
        if (!ready || !this.sheetsApi) {
            logger.warn('Google Sheets not available, skipping push');
            return { success: false, sheetsUpdated: [] };
        }

        const updatedSheets: string[] = [];

        try {
            // Get existing sheet names
            const spreadsheet = await this.sheetsApi.spreadsheets.get({
                spreadsheetId: this.spreadsheetId,
            });
            const existingSheets = spreadsheet.data.sheets?.map((s) => ({
                title: s.properties?.title || '',
                sheetId: s.properties?.sheetId || 0,
            })) || [];

            const sheetRows = sheetsToRows(allSheets);

            for (const { sheetName, rows } of sheetRows) {
                const tabName = `${dateLabel}_${sheetName}`.substring(0, 100);

                try {
                    // Delete existing tab if it exists
                    const existing = existingSheets.find((s) => s.title === tabName);
                    if (existing) {
                        await this.sheetsApi.spreadsheets.batchUpdate({
                            spreadsheetId: this.spreadsheetId,
                            requestBody: {
                                requests: [{ deleteSheet: { sheetId: existing.sheetId } }],
                            },
                        });
                    }

                    // Create new tab
                    await this.sheetsApi.spreadsheets.batchUpdate({
                        spreadsheetId: this.spreadsheetId,
                        requestBody: {
                            requests: [
                                {
                                    addSheet: {
                                        properties: { title: tabName },
                                    },
                                },
                            ],
                        },
                    });

                    // Write data
                    await this.sheetsApi.spreadsheets.values.update({
                        spreadsheetId: this.spreadsheetId,
                        range: `${tabName}!A1`,
                        valueInputOption: 'USER_ENTERED',
                        requestBody: { values: rows },
                    });

                    // Bold header row + freeze
                    const newSpreadsheet = await this.sheetsApi.spreadsheets.get({
                        spreadsheetId: this.spreadsheetId,
                    });
                    const newSheet = newSpreadsheet.data.sheets?.find(
                        (s) => s.properties?.title === tabName
                    );
                    if (newSheet?.properties?.sheetId !== undefined) {
                        await this.sheetsApi.spreadsheets.batchUpdate({
                            spreadsheetId: this.spreadsheetId,
                            requestBody: {
                                requests: [
                                    {
                                        repeatCell: {
                                            range: {
                                                sheetId: newSheet.properties!.sheetId!,
                                                startRowIndex: 0,
                                                endRowIndex: 1,
                                            },
                                            cell: {
                                                userEnteredFormat: {
                                                    textFormat: { bold: true },
                                                    backgroundColor: { red: 0.85, green: 0.88, blue: 0.95 },
                                                },
                                            },
                                            fields: 'userEnteredFormat(textFormat,backgroundColor)',
                                        },
                                    },
                                    {
                                        updateSheetProperties: {
                                            properties: {
                                                sheetId: newSheet.properties!.sheetId!,
                                                gridProperties: { frozenRowCount: 1 },
                                            },
                                            fields: 'gridProperties.frozenRowCount',
                                        },
                                    },
                                ],
                            },
                        });
                    }

                    updatedSheets.push(tabName);
                    logger.info(`Google Sheet tab updated: ${tabName}`, {
                        rows: rows.length,
                    });
                } catch (tabError) {
                    logger.error(`Failed to update sheet tab: ${tabName}`, { error: tabError });
                }
            }

            return { success: true, sheetsUpdated: updatedSheets };
        } catch (error) {
            logger.error('Failed to push data to Google Sheets', { error });
            return { success: false, sheetsUpdated: updatedSheets };
        }
    }

    // ==========================================================================
    // RESTORE (DB RECOVERY FROM SHEETS)
    // ==========================================================================

    /**
     * 🔴 CRITICAL: Restore database from Google Sheets snapshot data.
     *
     * Reads sheet tabs with the given date prefix and re-inserts data
     * into the database in dependency order.
     *
     * @param options.spreadsheetId - Override spreadsheet ID
     * @param options.sheetDate - Date prefix to look for (e.g. '16-02-2026')
     * @param options.dryRun - If true, only log what would be restored
     * @param options.force - If true, skip safety check for existing data
     */
    async restoreFromSheets(options: RestoreOptions = {}): Promise<RestoreResult> {
        const spreadsheetId = options.spreadsheetId || this.spreadsheetId;
        const dryRun = options.dryRun ?? true; // Default to dry run for safety
        const force = options.force ?? false;

        const result: RestoreResult = {
            success: false,
            dryRun,
            tables: [],
            errors: [],
        };

        const ready = await this.init();
        if (!ready || !this.sheetsApi) {
            result.errors.push('Google Sheets API not initialized');
            return result;
        }

        try {
            // 1. Get all sheet tabs
            const spreadsheet = await this.sheetsApi.spreadsheets.get({
                spreadsheetId,
            });
            const allTabs = spreadsheet.data.sheets?.map((s) => s.properties?.title || '') || [];

            // 2. Find tabs matching the date prefix
            const datePrefix = options.sheetDate || '';
            const matchingTabs = datePrefix
                ? allTabs.filter((t) => t.startsWith(datePrefix))
                : allTabs;

            if (matchingTabs.length === 0) {
                result.errors.push(`No sheet tabs found${datePrefix ? ` matching prefix "${datePrefix}"` : ''}`);
                return result;
            }

            logger.info(`Found ${matchingTabs.length} sheet tabs for restore`, { matchingTabs });

            // 3. Safety check — refuse if tables have data (unless force)
            if (!force && !dryRun) {
                const safetyChecks = await this.checkExistingData();
                if (safetyChecks.hasData) {
                    result.errors.push(
                        `Safety check failed: Tables already contain data (${safetyChecks.tables.join(', ')}). ` +
                        `Use force: true to override, or dryRun: true to preview.`
                    );
                    return result;
                }
            }

            // 4. Read and restore each matching tab
            const restorations: { tabName: string; table: string; rows: any[][] }[] = [];

            for (const tabName of matchingTabs) {
                try {
                    const response = await this.sheetsApi.spreadsheets.values.get({
                        spreadsheetId,
                        range: `${tabName}!A:ZZ`,
                    });

                    const values = response.data.values;
                    if (!values || values.length < 2) {
                        logger.info(`Skipping empty tab: ${tabName}`);
                        continue;
                    }

                    const header = values[0] as string[];
                    const dataRows = values.slice(1);

                    // Determine which DB table this maps to based on tab name
                    const tableName = this.detectTableFromTab(tabName);

                    restorations.push({ tabName, table: tableName, rows: [header, ...dataRows] });
                } catch (tabError) {
                    result.errors.push(`Failed to read tab "${tabName}": ${tabError}`);
                }
            }

            // 5. Execute restorations in dependency order
            const orderedTables = [
                'customers',
                'inventory',
                'invoices',
                'payments',
                'gold_loans',
                'pledged_gold',
                'loan_payments',
                'journal_entries',
            ];

            for (const targetTable of orderedTables) {
                const restoration = restorations.find((r) => r.table === targetTable);
                if (!restoration) continue;

                const { tabName, rows } = restoration;
                const header = rows[0] as string[];
                const dataRows = rows.slice(1);

                const tableResult = {
                    tableName: targetTable,
                    rowCount: dataRows.length,
                    status: dryRun ? 'DRY_RUN' : 'pending',
                };

                if (dryRun) {
                    logger.info(`[DRY RUN] Would restore ${dataRows.length} rows to "${targetTable}" from tab "${tabName}"`);
                    result.tables.push(tableResult);
                    continue;
                }

                try {
                    await this.restoreTable(targetTable, header, dataRows);
                    tableResult.status = 'restored';
                    logger.info(`Restored ${dataRows.length} rows to "${targetTable}"`);
                } catch (restoreError: any) {
                    tableResult.status = `error: ${restoreError.message}`;
                    result.errors.push(`Failed to restore "${targetTable}": ${restoreError.message}`);
                    logger.error(`Failed to restore table "${targetTable}"`, { error: restoreError });
                }

                result.tables.push(tableResult);
            }

            // Also handle any tabs that didn't match known tables
            for (const restoration of restorations) {
                if (!orderedTables.includes(restoration.table)) {
                    result.tables.push({
                        tableName: restoration.table,
                        rowCount: restoration.rows.length - 1,
                        status: 'skipped (unknown table)',
                    });
                }
            }

            result.success = result.errors.length === 0;
            return result;
        } catch (error: any) {
            result.errors.push(`Restore failed: ${error.message}`);
            logger.error('Database restore from Google Sheets failed', { error });
            return result;
        }
    }

    /**
     * Check if target tables already have data.
     */
    private async checkExistingData(): Promise<{
        hasData: boolean;
        tables: string[];
    }> {
        const tablesWithData: string[] = [];

        const checks = [
            { name: 'customers', query: sql`SELECT COUNT(*) as count FROM customers` },
            { name: 'inventory_items', query: sql`SELECT COUNT(*) as count FROM inventory_items` },
            { name: 'invoices', query: sql`SELECT COUNT(*) as count FROM invoices` },
            { name: 'gold_loans', query: sql`SELECT COUNT(*) as count FROM gold_loans` },
        ];

        for (const check of checks) {
            try {
                const result = await db.execute(check.query);
                const count = Number((result as any)?.[0]?.count || 0);
                if (count > 0) {
                    tablesWithData.push(`${check.name} (${count} rows)`);
                }
            } catch {
                // Table might not exist
            }
        }

        return {
            hasData: tablesWithData.length > 0,
            tables: tablesWithData,
        };
    }

    /**
     * Detect which DB table a sheet tab maps to based on tab name.
     */
    private detectTableFromTab(tabName: string): string {
        const lower = tabName.toLowerCase();
        if (lower.includes('active inventory') || lower.includes('inventory')) return 'inventory';
        if (lower.includes('invoices')) return 'invoices';
        if (lower.includes('loan payment')) return 'loan_payments';
        if (lower.includes('active loan')) return 'gold_loans';
        if (lower.includes('pledged gold')) return 'pledged_gold';
        if (lower.includes('payment')) return 'payments';
        if (lower.includes('journal')) return 'journal_entries';
        if (lower.includes('customer')) return 'customers';
        if (lower.includes('daily summary')) return 'daily_summary';
        if (lower.includes('metal position')) return 'metal_position';
        return 'unknown';
    }

    /**
     * Restore a specific table from sheet data.
     * Maps header columns to DB columns and inserts rows.
     */
    private async restoreTable(
        tableName: string,
        header: string[],
        dataRows: any[][]
    ): Promise<void> {
        switch (tableName) {
            case 'customers':
                await this.restoreCustomers(header, dataRows);
                break;
            case 'inventory':
                await this.restoreInventory(header, dataRows);
                break;
            case 'invoices':
                await this.restoreInvoices(header, dataRows);
                break;
            case 'payments':
                await this.restorePayments(header, dataRows);
                break;
            case 'gold_loans':
                await this.restoreGoldLoans(header, dataRows);
                break;
            case 'pledged_gold':
                await this.restorePledgedGold(header, dataRows);
                break;
            case 'loan_payments':
                await this.restoreLoanPayments(header, dataRows);
                break;
            case 'journal_entries':
                await this.restoreJournalEntries(header, dataRows);
                break;
            default:
                logger.warn(`No restore handler for table: ${tableName}`);
        }
    }

    // --- Type Coercion Helpers ---

    private toStr(val: any): string {
        return val?.toString()?.trim() || '';
    }

    private toNum(val: any): number {
        if (val === null || val === undefined || val === '') return 0;
        const cleaned = val.toString().replace(/[₹,\s]/g, '').replace(' g', '');
        const n = Number(cleaned);
        return isNaN(n) ? 0 : n;
    }

    private toDate(val: any): Date | null {
        if (!val) return null;
        const str = val.toString().trim();
        // Handle DD-MM-YYYY format
        const ddmmyyyy = str.match(/^(\d{2})-(\d{2})-(\d{4})$/);
        if (ddmmyyyy) {
            return new Date(Number(ddmmyyyy[3]), Number(ddmmyyyy[2]) - 1, Number(ddmmyyyy[1]));
        }
        const parsed = new Date(str);
        return isNaN(parsed.getTime()) ? null : parsed;
    }

    private toBool(val: any): boolean {
        if (typeof val === 'boolean') return val;
        const str = val?.toString()?.toLowerCase()?.trim();
        return str === 'true' || str === 'yes' || str === '1';
    }

    private colIndex(header: string[], name: string): number {
        return header.findIndex(
            (h) => h.toLowerCase().trim() === name.toLowerCase().trim()
        );
    }

    private getVal(row: any[], header: string[], colName: string): any {
        const idx = this.colIndex(header, colName);
        return idx >= 0 ? row[idx] : undefined;
    }

    // --- Table-Specific Restore Methods ---

    /**
     * Restore customers from sheet data.
     * Requires a store to exist — uses the first active store.
     */
    private async restoreCustomers(header: string[], dataRows: any[][]): Promise<void> {
        // We need a valid storeId — get the first active store
        const activeStores = await db
            .select({ id: stores.id })
            .from(stores)
            .where(eq(stores.isActive, true))
            .limit(1);

        if (activeStores.length === 0) {
            throw new Error('No active stores found. Please create stores before restoring customers.');
        }

        const storeId = activeStores[0].id;

        for (const row of dataRows) {
            const customerName = this.toStr(this.getVal(row, header, 'Customer'));
            if (!customerName) continue;

            const nameParts = customerName.split(' ');
            const firstName = nameParts[0] || 'Unknown';
            const lastName = nameParts.slice(1).join(' ') || null;

            const phone = this.toStr(this.getVal(row, header, 'Phone'));

            try {
                await db.insert(customers).values({
                    storeId,
                    customerCode: `RESTORED-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                    firstName,
                    lastName,
                    phone: phone || '0000000000',
                }).onConflictDoNothing();
            } catch (insertError) {
                logger.warn(`Failed to restore customer: ${customerName}`, { error: insertError });
            }
        }
    }

    /**
     * Restore inventory items from sheet data.
     */
    private async restoreInventory(header: string[], dataRows: any[][]): Promise<void> {
        const activeStores = await db
            .select({ id: stores.id, name: stores.name })
            .from(stores)
            .where(eq(stores.isActive, true));

        const storeMap = new Map(activeStores.map((s) => [s.name, s.id]));
        const defaultStoreId = activeStores[0]?.id;

        if (!defaultStoreId) {
            throw new Error('No active stores found.');
        }

        for (const row of dataRows) {
            const sku = this.toStr(this.getVal(row, header, 'SKU'));
            const name = this.toStr(this.getVal(row, header, 'Name'));
            if (!sku || !name) continue;

            const storeName = this.toStr(this.getVal(row, header, 'Store'));
            const storeId = storeMap.get(storeName) || defaultStoreId;

            try {
                await db.insert(inventoryItems).values({
                    storeId,
                    sku,
                    name,
                    itemType: this.toStr(this.getVal(row, header, 'Item Type')) || 'finished_goods',
                    metalType: this.toStr(this.getVal(row, header, 'Metal Type')) || null,
                    purity: this.toStr(this.getVal(row, header, 'Purity')) || null,
                    grossWeight: this.toNum(this.getVal(row, header, 'Gross Weight (g)')).toFixed(3),
                    netWeight: this.toNum(this.getVal(row, header, 'Net Weight (g)')).toFixed(3),
                    stoneWeight: this.toNum(this.getVal(row, header, 'Stone Weight (g)')).toFixed(3),
                    makingCharges: this.toNum(this.getVal(row, header, 'Making Charges')).toFixed(2),
                    calculatedCost: this.toNum(this.getVal(row, header, 'Cost')).toFixed(2),
                    currentMarketValue: this.toNum(this.getVal(row, header, 'Market Value')).toFixed(2),
                    status: this.toStr(this.getVal(row, header, 'Status')) || 'available',
                    barcode: this.toStr(this.getVal(row, header, 'Barcode')) || null,
                }).onConflictDoNothing();
            } catch (insertError) {
                logger.warn(`Failed to restore inventory item: ${sku}`, { error: insertError });
            }
        }
    }

    /**
     * Restore invoices from sheet data.
     * Note: This creates skeleton invoices — full detail requires invoice items which
     * may not be in the snapshot. Use alongside DB backups for complete recovery.
     */
    private async restoreInvoices(header: string[], dataRows: any[][]): Promise<void> {
        const activeStores = await db
            .select({ id: stores.id, name: stores.name })
            .from(stores)
            .where(eq(stores.isActive, true));

        const storeMap = new Map(activeStores.map((s) => [s.name, s.id]));
        const defaultStoreId = activeStores[0]?.id;

        if (!defaultStoreId) {
            throw new Error('No active stores found.');
        }

        // Get a valid user for createdBy
        const adminUser = await db.execute(
            sql`SELECT id FROM users WHERE is_active = true LIMIT 1`
        );
        const createdBy = (adminUser as any)?.[0]?.id;
        if (!createdBy) {
            throw new Error('No active users found. Please create users before restoring invoices.');
        }

        for (const row of dataRows) {
            const invoiceNumber = this.toStr(this.getVal(row, header, 'Invoice #'));
            if (!invoiceNumber) continue;

            const storeName = this.toStr(this.getVal(row, header, 'Store'));
            const storeId = storeMap.get(storeName) || defaultStoreId;

            try {
                await db.insert(invoices).values({
                    storeId,
                    invoiceNumber,
                    invoiceDate: this.toDate(this.getVal(row, header, 'Date')) || new Date(),
                    totalAmount: this.toNum(this.getVal(row, header, 'Total Amount')).toFixed(2),
                    discountAmount: this.toNum(this.getVal(row, header, 'Discount')).toFixed(2),
                    taxAmount: this.toNum(this.getVal(row, header, 'Tax')).toFixed(2),
                    finalAmount: this.toNum(this.getVal(row, header, 'Final Amount')).toFixed(2),
                    paymentStatus: this.toStr(this.getVal(row, header, 'Payment Status')) || 'paid',
                    createdBy,
                }).onConflictDoNothing();
            } catch (insertError) {
                logger.warn(`Failed to restore invoice: ${invoiceNumber}`, { error: insertError });
            }
        }
    }

    /**
     * Restore payments from sheet data.
     */
    private async restorePayments(header: string[], dataRows: any[][]): Promise<void> {
        // We need to map invoice numbers to IDs
        const existingInvoices = await db
            .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber })
            .from(invoices);

        const invoiceMap = new Map(existingInvoices.map((i) => [i.invoiceNumber, i.id]));

        const adminUser = await db.execute(
            sql`SELECT id FROM users WHERE is_active = true LIMIT 1`
        );
        const createdBy = (adminUser as any)?.[0]?.id;
        if (!createdBy) {
            throw new Error('No active users found.');
        }

        for (const row of dataRows) {
            const invoiceNumber = this.toStr(this.getVal(row, header, 'Invoice #'));
            const invoiceId = invoiceMap.get(invoiceNumber);
            if (!invoiceId) {
                logger.warn(`Cannot restore payment — invoice "${invoiceNumber}" not found`);
                continue;
            }

            try {
                await db.insert(payments).values({
                    invoiceId,
                    paymentDate: this.toDate(this.getVal(row, header, 'Payment Date')) || new Date(),
                    paymentMethod: this.toStr(this.getVal(row, header, 'Method')) || 'cash',
                    amount: this.toNum(this.getVal(row, header, 'Amount')).toFixed(2),
                    transactionReference: this.toStr(this.getVal(row, header, 'Reference')) || null,
                    notes: this.toStr(this.getVal(row, header, 'Notes')) || null,
                    createdBy,
                });
            } catch (insertError) {
                logger.warn(`Failed to restore payment for invoice: ${invoiceNumber}`, { error: insertError });
            }
        }
    }

    /**
     * Restore gold loans from sheet data.
     */
    private async restoreGoldLoans(header: string[], dataRows: any[][]): Promise<void> {
        const activeStores = await db
            .select({ id: stores.id, name: stores.name })
            .from(stores)
            .where(eq(stores.isActive, true));

        const storeMap = new Map(activeStores.map((s) => [s.name, s.id]));
        const defaultStoreId = activeStores[0]?.id;

        if (!defaultStoreId) throw new Error('No active stores found.');

        const adminUser = await db.execute(
            sql`SELECT id FROM users WHERE is_active = true LIMIT 1`
        );
        const createdBy = (adminUser as any)?.[0]?.id;
        if (!createdBy) throw new Error('No active users found.');

        // Get customer map
        const existingCustomers = await db
            .select({ id: customers.id, firstName: customers.firstName, lastName: customers.lastName, phone: customers.phone })
            .from(customers);

        for (const row of dataRows) {
            const loanNumber = this.toStr(this.getVal(row, header, 'Loan #'));
            if (!loanNumber) continue;

            const storeName = this.toStr(this.getVal(row, header, 'Store'));
            const storeId = storeMap.get(storeName) || defaultStoreId;

            // Try to match customer by name
            const customerName = this.toStr(this.getVal(row, header, 'Customer'));
            let customerId = existingCustomers[0]?.id; // fallback

            if (customerName) {
                const match = existingCustomers.find((c) => {
                    const fullName = `${c.firstName} ${c.lastName || ''}`.trim();
                    return fullName.toLowerCase() === customerName.toLowerCase();
                });
                if (match) customerId = match.id;
            }

            if (!customerId) {
                logger.warn(`Cannot restore loan "${loanNumber}" — no customers in database`);
                continue;
            }

            try {
                await db.insert(goldLoans).values({
                    storeId,
                    loanNumber,
                    customerId,
                    applicationDate: this.toDate(this.getVal(row, header, 'Application Date')) || new Date(),
                    loanAmount: this.toNum(this.getVal(row, header, 'Loan Amount')).toFixed(2),
                    interestRate: this.toNum(this.getVal(row, header, 'Interest Rate %')).toFixed(2),
                    tenure: this.toNum(this.getVal(row, header, 'Tenure (months)')) || 12,
                    loanType: this.toStr(this.getVal(row, header, 'Loan Type')) || 'bullet',
                    status: this.toStr(this.getVal(row, header, 'Status')) || 'active',
                    maturityDate: this.toDate(this.getVal(row, header, 'Maturity Date')),
                    accruedInterest: this.toNum(this.getVal(row, header, 'Accrued Interest')).toFixed(2),
                    outstandingBalance: this.toNum(this.getVal(row, header, 'Outstanding')).toFixed(2),
                    totalGoldValue: this.toNum(this.getVal(row, header, 'Total Gold Value')).toFixed(2),
                    currentLtv: this.toNum(this.getVal(row, header, 'Current LTV %')).toFixed(2),
                    ltvStatus: this.toStr(this.getVal(row, header, 'LTV Status')) || 'safe',
                    createdBy,
                }).onConflictDoNothing();
            } catch (insertError) {
                logger.warn(`Failed to restore gold loan: ${loanNumber}`, { error: insertError });
            }
        }
    }

    /**
     * Restore pledged gold items from sheet data.
     */
    private async restorePledgedGold(header: string[], dataRows: any[][]): Promise<void> {
        // Map loan numbers to IDs
        const existingLoans = await db
            .select({ id: goldLoans.id, loanNumber: goldLoans.loanNumber })
            .from(goldLoans);

        const loanMap = new Map(existingLoans.map((l) => [l.loanNumber, l.id]));

        for (const row of dataRows) {
            const loanNumber = this.toStr(this.getVal(row, header, 'Loan #'));
            const loanId = loanMap.get(loanNumber);
            if (!loanId) {
                logger.warn(`Cannot restore pledged gold — loan "${loanNumber}" not found`);
                continue;
            }

            try {
                await db.insert(pledgedGold).values({
                    loanId,
                    itemDescription: this.toStr(this.getVal(row, header, 'Description')) || 'Gold Item',
                    itemType: this.toStr(this.getVal(row, header, 'Type')) || null,
                    quantity: this.toNum(this.getVal(row, header, 'Qty')) || 1,
                    grossWeight: this.toNum(this.getVal(row, header, 'Gross Weight (g)')).toFixed(3),
                    netWeight: this.toNum(this.getVal(row, header, 'Net Weight (g)')).toFixed(3),
                    purity: this.toStr(this.getVal(row, header, 'Purity')) || '22K',
                    goldValue: this.toNum(this.getVal(row, header, 'Gold Value')).toFixed(2),
                    appraisalValue: this.toNum(this.getVal(row, header, 'Appraisal Value')).toFixed(2),
                    currentMarketValue: this.toNum(this.getVal(row, header, 'Market Value')).toFixed(2),
                    storageLocation: this.toStr(this.getVal(row, header, 'Location')) || null,
                });
            } catch (insertError) {
                logger.warn(`Failed to restore pledged gold for loan: ${loanNumber}`, { error: insertError });
            }
        }
    }

    /**
     * Restore loan payments from sheet data.
     */
    private async restoreLoanPayments(header: string[], dataRows: any[][]): Promise<void> {
        const existingLoans = await db
            .select({ id: goldLoans.id, loanNumber: goldLoans.loanNumber })
            .from(goldLoans);

        const loanMap = new Map(existingLoans.map((l) => [l.loanNumber, l.id]));

        const adminUser = await db.execute(
            sql`SELECT id FROM users WHERE is_active = true LIMIT 1`
        );
        const createdBy = (adminUser as any)?.[0]?.id;
        if (!createdBy) throw new Error('No active users found.');

        for (const row of dataRows) {
            const loanNumber = this.toStr(this.getVal(row, header, 'Loan #'));
            const loanId = loanMap.get(loanNumber);
            if (!loanId) continue;

            try {
                await db.insert(loanPayments).values({
                    loanId,
                    paymentDate: this.toDate(this.getVal(row, header, 'Payment Date')) || new Date(),
                    amount: this.toNum(this.getVal(row, header, 'Amount')).toFixed(2),
                    paymentType: this.toStr(this.getVal(row, header, 'Type')) || 'partial',
                    principalAmount: this.toNum(this.getVal(row, header, 'Principal')).toFixed(2),
                    interestAmount: this.toNum(this.getVal(row, header, 'Interest')).toFixed(2),
                    penaltyAmount: this.toNum(this.getVal(row, header, 'Penalty')).toFixed(2),
                    outstandingBalance: this.toNum(this.getVal(row, header, 'Outstanding')).toFixed(2),
                    createdBy,
                });
            } catch (insertError) {
                logger.warn(`Failed to restore loan payment for: ${loanNumber}`, { error: insertError });
            }
        }
    }

    /**
     * Restore journal entries from sheet data.
     * Note: Only restores header entries, not individual line items.
     */
    private async restoreJournalEntries(header: string[], dataRows: any[][]): Promise<void> {
        const activeStores = await db
            .select({ id: stores.id, name: stores.name })
            .from(stores)
            .where(eq(stores.isActive, true));

        const storeMap = new Map(activeStores.map((s) => [s.name, s.id]));
        const defaultStoreId = activeStores[0]?.id;

        if (!defaultStoreId) throw new Error('No active stores found.');

        const adminUser = await db.execute(
            sql`SELECT id FROM users WHERE is_active = true LIMIT 1`
        );
        const createdBy = (adminUser as any)?.[0]?.id;
        if (!createdBy) throw new Error('No active users found.');

        for (const row of dataRows) {
            const entryNumber = this.toStr(this.getVal(row, header, 'Entry #'));
            if (!entryNumber) continue;

            const storeName = this.toStr(this.getVal(row, header, 'Store'));
            const storeId = storeMap.get(storeName) || defaultStoreId;

            try {
                await db.insert(journalEntries).values({
                    storeId,
                    entryNumber,
                    entryDate: this.toDate(this.getVal(row, header, 'Date')) || new Date(),
                    entryType: this.toStr(this.getVal(row, header, 'Type')) || 'adjustment',
                    totalDebit: this.toNum(this.getVal(row, header, 'Total Debit')).toFixed(2),
                    totalCredit: this.toNum(this.getVal(row, header, 'Total Credit')).toFixed(2),
                    narration: this.toStr(this.getVal(row, header, 'Narration')) || null,
                    status: this.toStr(this.getVal(row, header, 'Status')) || 'posted',
                    createdBy,
                }).onConflictDoNothing();
            } catch (insertError) {
                logger.warn(`Failed to restore journal entry: ${entryNumber}`, { error: insertError });
            }
        }
    }
}

// Export singleton
export const googleSheetsExportService = new GoogleSheetsExportService();
