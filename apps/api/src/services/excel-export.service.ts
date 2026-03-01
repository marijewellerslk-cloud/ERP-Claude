/**
 * Excel Export Service
 * Generates .xlsx snapshot files for daily backup/audit trail.
 * Uses SheetJS (xlsx) for workbook generation with styling.
 */

import * as XLSX from 'xlsx';
import path from 'node:path';
import { promises as fsPromises } from 'node:fs';
import { db } from '../config/database.js';
import {
    invoices,
    invoiceItems,
    payments,
    loanPayments,
    journalEntries,
    journalEntryLines,
    inventoryItems,
    inventoryCategories,
    goldLoans,
    pledgedGold,
    customers,
    stores,
} from '../db/schema.js';
import { eq, and, gte, lte, sql, isNull, inArray, not } from 'drizzle-orm';
import { dailySummaryService } from './daily-summary.service.js';
import { metalAccountingService } from './metal-accounting.service.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export interface SheetData {
    sheetName: string;
    data: Record<string, any>[];
    columns: ColumnDef[];
}

export interface ColumnDef {
    header: string;
    key: string;
    width?: number;
    format?: 'currency' | 'weight' | 'date' | 'percentage' | 'text' | 'number';
}

export interface ExportResult {
    filePath: string;
    fileName: string;
    sheetsCount: number;
    rowsCount: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SNAPSHOT_DIR = './daily-snapshots';

// Number formats
const CURRENCY_FMT = '₹#,##0.00';
const WEIGHT_FMT = '#,##0.000';
const DATE_FMT = 'DD-MM-YYYY';
const PERCENTAGE_FMT = '0.00%';

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

function formatDateStr(d: Date | string | null | undefined): string {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(date.getTime())) return '';
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
}

function toNumber(val: any): number {
    if (val === null || val === undefined || val === '') return 0;
    const n = Number(val);
    return isNaN(n) ? 0 : n;
}

function formatCurrency(val: any): string {
    const n = toNumber(val);
    return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatWeight(val: any): string {
    const n = toNumber(val);
    return `${n.toFixed(3)} g`;
}

// ============================================================================
// WORKBOOK GENERATION
// ============================================================================

function createStyledWorkbook(sheets: SheetData[]): XLSX.WorkBook {
    const wb = XLSX.utils.book_new();

    for (const sheet of sheets) {
        if (!sheet.data.length) {
            // Create empty sheet with headers only
            const ws = XLSX.utils.aoa_to_sheet([sheet.columns.map((c) => c.header)]);
            applySheetStyles(ws, sheet.columns, 0);
            XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName.substring(0, 31));
            continue;
        }

        // Build rows: format values based on column definitions
        const rows = sheet.data.map((row) => {
            const formattedRow: Record<string, any> = {};
            for (const col of sheet.columns) {
                const val = row[col.key];
                switch (col.format) {
                    case 'currency':
                        formattedRow[col.header] = toNumber(val);
                        break;
                    case 'weight':
                        formattedRow[col.header] = toNumber(val);
                        break;
                    case 'date':
                        formattedRow[col.header] = formatDateStr(val);
                        break;
                    case 'percentage':
                        formattedRow[col.header] = toNumber(val);
                        break;
                    case 'number':
                        formattedRow[col.header] = toNumber(val);
                        break;
                    default:
                        formattedRow[col.header] = val ?? '';
                }
            }
            return formattedRow;
        });

        const ws = XLSX.utils.json_to_sheet(rows, {
            header: sheet.columns.map((c) => c.header),
        });

        applySheetStyles(ws, sheet.columns, sheet.data.length);
        XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName.substring(0, 31));
    }

    return wb;
}

function applySheetStyles(ws: XLSX.WorkSheet, columns: ColumnDef[], rowCount: number): void {
    // Set column widths
    ws['!cols'] = columns.map((col) => ({
        wch: col.width || Math.max(col.header.length + 2, 14),
    }));

    // Freeze the header row
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    // Alternative: SheetJS uses '!freeze' or views
    if (!ws['!views']) ws['!views'] = [];
    (ws['!views'] as any[]).push({ state: 'frozen', ySplit: 1 });

    // Apply number formats to cells
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const col = columns[C];
        if (!col) continue;

        // Format header cell (bold)
        const headerAddr = XLSX.utils.encode_cell({ r: 0, c: C });
        if (ws[headerAddr]) {
            if (!ws[headerAddr].s) ws[headerAddr].s = {};
            ws[headerAddr].s = { font: { bold: true }, fill: { fgColor: { rgb: 'D9E1F2' } } };
        }

        // Format data cells
        let fmt: string | undefined;
        if (col.format === 'currency') fmt = CURRENCY_FMT;
        else if (col.format === 'weight') fmt = WEIGHT_FMT;
        else if (col.format === 'percentage') fmt = PERCENTAGE_FMT;

        if (fmt) {
            for (let R = 1; R <= rowCount; ++R) {
                const addr = XLSX.utils.encode_cell({ r: R, c: C });
                if (ws[addr] && ws[addr].t === 'n') {
                    ws[addr].z = fmt;
                }
            }
        }
    }
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * Export transactions: invoices, payments, loan_payments, journal_entries
 * for a date range (default: today + last 7 days).
 */
export async function exportTransactions(
    storeId?: string,
    from?: Date,
    to?: Date
): Promise<SheetData[]> {
    const now = new Date();
    const toDate = to || now;
    const fromDate = from || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const storeFilter = storeId ? eq(invoices.storeId, storeId) : undefined;

    // 1. Invoices
    const invoiceRows = await db
        .select({
            invoiceNumber: invoices.invoiceNumber,
            invoiceDate: invoices.invoiceDate,
            customerName: sql<string>`COALESCE(${customers.firstName} || ' ' || COALESCE(${customers.lastName}, ''), 'Walk-in')`,
            totalAmount: invoices.totalAmount,
            discountAmount: invoices.discountAmount,
            taxAmount: invoices.taxAmount,
            finalAmount: invoices.finalAmount,
            paymentStatus: invoices.paymentStatus,
            storeName: stores.name,
        })
        .from(invoices)
        .leftJoin(customers, eq(invoices.customerId, customers.id))
        .leftJoin(stores, eq(invoices.storeId, stores.id))
        .where(
            and(
                gte(invoices.invoiceDate, fromDate),
                lte(invoices.invoiceDate, toDate),
                isNull(invoices.deletedAt),
                storeFilter
            )
        )
        .orderBy(invoices.invoiceDate);

    // 2. Payments
    const paymentRows = await db
        .select({
            invoiceNumber: invoices.invoiceNumber,
            paymentDate: payments.paymentDate,
            paymentMethod: payments.paymentMethod,
            amount: payments.amount,
            transactionReference: payments.transactionReference,
            notes: payments.notes,
        })
        .from(payments)
        .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
        .where(
            and(
                gte(payments.paymentDate, fromDate),
                lte(payments.paymentDate, toDate),
                isNull(invoices.deletedAt),
                storeId ? eq(invoices.storeId, storeId) : undefined
            )
        )
        .orderBy(payments.paymentDate);

    // 3. Loan Payments
    const loanPaymentRows = await db
        .select({
            loanNumber: goldLoans.loanNumber,
            paymentDate: loanPayments.paymentDate,
            amount: loanPayments.amount,
            paymentType: loanPayments.paymentType,
            principalAmount: loanPayments.principalAmount,
            interestAmount: loanPayments.interestAmount,
            penaltyAmount: loanPayments.penaltyAmount,
            outstandingBalance: loanPayments.outstandingBalance,
        })
        .from(loanPayments)
        .innerJoin(goldLoans, eq(loanPayments.loanId, goldLoans.id))
        .where(
            and(
                gte(loanPayments.paymentDate, fromDate),
                lte(loanPayments.paymentDate, toDate),
                storeId ? eq(goldLoans.storeId, storeId) : undefined
            )
        )
        .orderBy(loanPayments.paymentDate);

    // 4. Journal Entries (non-reversed)
    const journalRows = await db
        .select({
            entryNumber: journalEntries.entryNumber,
            entryDate: journalEntries.entryDate,
            entryType: journalEntries.entryType,
            totalDebit: journalEntries.totalDebit,
            totalCredit: journalEntries.totalCredit,
            narration: journalEntries.narration,
            status: journalEntries.status,
            storeName: stores.name,
        })
        .from(journalEntries)
        .leftJoin(stores, eq(journalEntries.storeId, stores.id))
        .where(
            and(
                gte(journalEntries.entryDate, fromDate),
                lte(journalEntries.entryDate, toDate),
                not(eq(journalEntries.status, 'reversed')),
                storeId ? eq(journalEntries.storeId, storeId) : undefined
            )
        )
        .orderBy(journalEntries.entryDate);

    return [
        {
            sheetName: 'Invoices',
            data: invoiceRows,
            columns: [
                { header: 'Invoice #', key: 'invoiceNumber', width: 16, format: 'text' },
                { header: 'Date', key: 'invoiceDate', width: 14, format: 'date' },
                { header: 'Customer', key: 'customerName', width: 24, format: 'text' },
                { header: 'Total Amount', key: 'totalAmount', width: 16, format: 'currency' },
                { header: 'Discount', key: 'discountAmount', width: 14, format: 'currency' },
                { header: 'Tax', key: 'taxAmount', width: 14, format: 'currency' },
                { header: 'Final Amount', key: 'finalAmount', width: 16, format: 'currency' },
                { header: 'Payment Status', key: 'paymentStatus', width: 16, format: 'text' },
                { header: 'Store', key: 'storeName', width: 20, format: 'text' },
            ],
        },
        {
            sheetName: 'Payments',
            data: paymentRows,
            columns: [
                { header: 'Invoice #', key: 'invoiceNumber', width: 16, format: 'text' },
                { header: 'Payment Date', key: 'paymentDate', width: 14, format: 'date' },
                { header: 'Method', key: 'paymentMethod', width: 14, format: 'text' },
                { header: 'Amount', key: 'amount', width: 16, format: 'currency' },
                { header: 'Reference', key: 'transactionReference', width: 24, format: 'text' },
                { header: 'Notes', key: 'notes', width: 30, format: 'text' },
            ],
        },
        {
            sheetName: 'Loan Payments',
            data: loanPaymentRows,
            columns: [
                { header: 'Loan #', key: 'loanNumber', width: 16, format: 'text' },
                { header: 'Payment Date', key: 'paymentDate', width: 14, format: 'date' },
                { header: 'Amount', key: 'amount', width: 16, format: 'currency' },
                { header: 'Type', key: 'paymentType', width: 14, format: 'text' },
                { header: 'Principal', key: 'principalAmount', width: 16, format: 'currency' },
                { header: 'Interest', key: 'interestAmount', width: 16, format: 'currency' },
                { header: 'Penalty', key: 'penaltyAmount', width: 14, format: 'currency' },
                { header: 'Outstanding', key: 'outstandingBalance', width: 16, format: 'currency' },
            ],
        },
        {
            sheetName: 'Journal Entries',
            data: journalRows,
            columns: [
                { header: 'Entry #', key: 'entryNumber', width: 18, format: 'text' },
                { header: 'Date', key: 'entryDate', width: 14, format: 'date' },
                { header: 'Type', key: 'entryType', width: 14, format: 'text' },
                { header: 'Total Debit', key: 'totalDebit', width: 16, format: 'currency' },
                { header: 'Total Credit', key: 'totalCredit', width: 16, format: 'currency' },
                { header: 'Narration', key: 'narration', width: 40, format: 'text' },
                { header: 'Status', key: 'status', width: 12, format: 'text' },
                { header: 'Store', key: 'storeName', width: 20, format: 'text' },
            ],
        },
    ];
}

/**
 * Export active inventory items (status=available/reserved, not deleted).
 */
export async function exportActiveInventory(storeId?: string): Promise<SheetData[]> {
    const rows = await db
        .select({
            sku: inventoryItems.sku,
            barcode: inventoryItems.barcode,
            name: inventoryItems.name,
            categoryName: inventoryCategories.name,
            itemType: inventoryItems.itemType,
            metalType: inventoryItems.metalType,
            purity: inventoryItems.purity,
            grossWeight: inventoryItems.grossWeight,
            netWeight: inventoryItems.netWeight,
            stoneWeight: inventoryItems.stoneWeight,
            makingCharges: inventoryItems.makingCharges,
            calculatedCost: inventoryItems.calculatedCost,
            currentMarketValue: inventoryItems.currentMarketValue,
            status: inventoryItems.status,
            storeName: stores.name,
            createdAt: inventoryItems.createdAt,
        })
        .from(inventoryItems)
        .leftJoin(inventoryCategories, eq(inventoryItems.categoryId, inventoryCategories.id))
        .leftJoin(stores, eq(inventoryItems.storeId, stores.id))
        .where(
            and(
                inArray(inventoryItems.status, ['available', 'reserved']),
                isNull(inventoryItems.deletedAt),
                storeId ? eq(inventoryItems.storeId, storeId) : undefined
            )
        )
        .orderBy(inventoryItems.sku);

    return [
        {
            sheetName: 'Active Inventory',
            data: rows,
            columns: [
                { header: 'SKU', key: 'sku', width: 16, format: 'text' },
                { header: 'Barcode', key: 'barcode', width: 16, format: 'text' },
                { header: 'Name', key: 'name', width: 28, format: 'text' },
                { header: 'Category', key: 'categoryName', width: 18, format: 'text' },
                { header: 'Item Type', key: 'itemType', width: 16, format: 'text' },
                { header: 'Metal Type', key: 'metalType', width: 12, format: 'text' },
                { header: 'Purity', key: 'purity', width: 10, format: 'text' },
                { header: 'Gross Weight (g)', key: 'grossWeight', width: 16, format: 'weight' },
                { header: 'Net Weight (g)', key: 'netWeight', width: 16, format: 'weight' },
                { header: 'Stone Weight (g)', key: 'stoneWeight', width: 16, format: 'weight' },
                { header: 'Making Charges', key: 'makingCharges', width: 16, format: 'currency' },
                { header: 'Cost', key: 'calculatedCost', width: 16, format: 'currency' },
                { header: 'Market Value', key: 'currentMarketValue', width: 16, format: 'currency' },
                { header: 'Status', key: 'status', width: 12, format: 'text' },
                { header: 'Store', key: 'storeName', width: 20, format: 'text' },
                { header: 'Added Date', key: 'createdAt', width: 14, format: 'date' },
            ],
        },
    ];
}

/**
 * Export active gold loans summary with pledged gold items.
 */
export async function exportActiveLoans(storeId?: string): Promise<SheetData[]> {
    // Active loans
    const loanRows = await db
        .select({
            loanNumber: goldLoans.loanNumber,
            customerName: sql<string>`${customers.firstName} || ' ' || COALESCE(${customers.lastName}, '')`,
            customerPhone: customers.phone,
            applicationDate: goldLoans.applicationDate,
            loanAmount: goldLoans.loanAmount,
            interestRate: goldLoans.interestRate,
            tenure: goldLoans.tenure,
            loanType: goldLoans.loanType,
            status: goldLoans.status,
            maturityDate: goldLoans.maturityDate,
            accruedInterest: goldLoans.accruedInterest,
            outstandingBalance: goldLoans.outstandingBalance,
            totalGoldValue: goldLoans.totalGoldValue,
            currentLtv: goldLoans.currentLtv,
            ltvStatus: goldLoans.ltvStatus,
            storeName: stores.name,
        })
        .from(goldLoans)
        .innerJoin(customers, eq(goldLoans.customerId, customers.id))
        .leftJoin(stores, eq(goldLoans.storeId, stores.id))
        .where(
            and(
                inArray(goldLoans.status, ['active', 'approved', 'margin_call']),
                isNull(goldLoans.deletedAt),
                storeId ? eq(goldLoans.storeId, storeId) : undefined
            )
        )
        .orderBy(goldLoans.loanNumber);

    // Pledged gold summary per loan
    const pledgedRows = await db
        .select({
            loanNumber: goldLoans.loanNumber,
            itemDescription: pledgedGold.itemDescription,
            itemType: pledgedGold.itemType,
            quantity: pledgedGold.quantity,
            grossWeight: pledgedGold.grossWeight,
            netWeight: pledgedGold.netWeight,
            purity: pledgedGold.purity,
            goldValue: pledgedGold.goldValue,
            appraisalValue: pledgedGold.appraisalValue,
            currentMarketValue: pledgedGold.currentMarketValue,
            storageLocation: pledgedGold.storageLocation,
            isReleased: pledgedGold.isReleased,
        })
        .from(pledgedGold)
        .innerJoin(goldLoans, eq(pledgedGold.loanId, goldLoans.id))
        .where(
            and(
                inArray(goldLoans.status, ['active', 'approved', 'margin_call']),
                isNull(goldLoans.deletedAt),
                eq(pledgedGold.isReleased, false),
                storeId ? eq(goldLoans.storeId, storeId) : undefined
            )
        )
        .orderBy(goldLoans.loanNumber);

    return [
        {
            sheetName: 'Active Loans',
            data: loanRows,
            columns: [
                { header: 'Loan #', key: 'loanNumber', width: 16, format: 'text' },
                { header: 'Customer', key: 'customerName', width: 24, format: 'text' },
                { header: 'Phone', key: 'customerPhone', width: 16, format: 'text' },
                { header: 'Application Date', key: 'applicationDate', width: 16, format: 'date' },
                { header: 'Loan Amount', key: 'loanAmount', width: 16, format: 'currency' },
                { header: 'Interest Rate %', key: 'interestRate', width: 14, format: 'number' },
                { header: 'Tenure (months)', key: 'tenure', width: 14, format: 'number' },
                { header: 'Loan Type', key: 'loanType', width: 14, format: 'text' },
                { header: 'Status', key: 'status', width: 14, format: 'text' },
                { header: 'Maturity Date', key: 'maturityDate', width: 14, format: 'date' },
                { header: 'Accrued Interest', key: 'accruedInterest', width: 16, format: 'currency' },
                { header: 'Outstanding', key: 'outstandingBalance', width: 16, format: 'currency' },
                { header: 'Total Gold Value', key: 'totalGoldValue', width: 16, format: 'currency' },
                { header: 'Current LTV %', key: 'currentLtv', width: 14, format: 'number' },
                { header: 'LTV Status', key: 'ltvStatus', width: 12, format: 'text' },
                { header: 'Store', key: 'storeName', width: 20, format: 'text' },
            ],
        },
        {
            sheetName: 'Pledged Gold Items',
            data: pledgedRows,
            columns: [
                { header: 'Loan #', key: 'loanNumber', width: 16, format: 'text' },
                { header: 'Description', key: 'itemDescription', width: 28, format: 'text' },
                { header: 'Type', key: 'itemType', width: 14, format: 'text' },
                { header: 'Qty', key: 'quantity', width: 8, format: 'number' },
                { header: 'Gross Weight (g)', key: 'grossWeight', width: 16, format: 'weight' },
                { header: 'Net Weight (g)', key: 'netWeight', width: 16, format: 'weight' },
                { header: 'Purity', key: 'purity', width: 10, format: 'text' },
                { header: 'Gold Value', key: 'goldValue', width: 16, format: 'currency' },
                { header: 'Appraisal Value', key: 'appraisalValue', width: 16, format: 'currency' },
                { header: 'Market Value', key: 'currentMarketValue', width: 16, format: 'currency' },
                { header: 'Location', key: 'storageLocation', width: 16, format: 'text' },
            ],
        },
    ];
}

/**
 * Export daily summary metrics.
 */
export async function exportDailySummary(
    storeId: string,
    date: Date = new Date()
): Promise<SheetData[]> {
    try {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const metrics = await dailySummaryService.calculateMetrics(storeId, startOfDay, endOfDay);

        // Flatten metrics into rows for the spreadsheet
        const summaryData = [
            {
                metric: 'Total Sales Amount',
                value: toNumber(metrics.salesMetrics?.totalSalesAmount),
                type: 'currency',
            },
            {
                metric: 'Invoice Count',
                value: toNumber(metrics.salesMetrics?.invoiceCount),
                type: 'number',
            },
            {
                metric: 'Average Invoice Value',
                value: toNumber(metrics.salesMetrics?.averageInvoiceValue),
                type: 'currency',
            },
            {
                metric: 'Cash Payments',
                value: toNumber(metrics.financialMetrics?.cashPayments),
                type: 'currency',
            },
            {
                metric: 'Card Payments',
                value: toNumber(metrics.financialMetrics?.cardPayments),
                type: 'currency',
            },
            {
                metric: 'UPI Payments',
                value: toNumber(metrics.financialMetrics?.upiPayments),
                type: 'currency',
            },
            {
                metric: 'Items Added',
                value: toNumber(metrics.inventoryMetrics?.itemsAdded),
                type: 'number',
            },
            {
                metric: 'Items Sold',
                value: toNumber(metrics.inventoryMetrics?.itemsSold),
                type: 'number',
            },
            {
                metric: 'Active Customers',
                value: toNumber(metrics.activityMetrics?.activeCustomers),
                type: 'number',
            },
        ];

        return [
            {
                sheetName: 'Daily Summary',
                data: summaryData,
                columns: [
                    { header: 'Metric', key: 'metric', width: 28, format: 'text' },
                    { header: 'Value', key: 'value', width: 18, format: 'currency' },
                    { header: 'Type', key: 'type', width: 12, format: 'text' },
                ],
            },
        ];
    } catch (error) {
        logger.warn('Failed to export daily summary', { storeId, error });
        return [
            {
                sheetName: 'Daily Summary',
                data: [{ metric: 'Error generating summary', value: '', type: '' }],
                columns: [
                    { header: 'Metric', key: 'metric', width: 28, format: 'text' },
                    { header: 'Value', key: 'value', width: 18, format: 'text' },
                    { header: 'Type', key: 'type', width: 12, format: 'text' },
                ],
            },
        ];
    }
}

/**
 * Export metal position data.
 */
export async function exportMetalPosition(storeId?: string): Promise<SheetData[]> {
    try {
        const position = await metalAccountingService.getMetalPosition(storeId);

        const storeData = position.stores.map((s) => ({
            storeName: s.storeName,
            storeCode: s.storeCode,
            inventoryGrossWeight: s.inventoryGold.totalGrossWeight,
            inventoryNetWeight: s.inventoryGold.totalNetWeight,
            inventoryFineGold: s.inventoryGold.totalFineGold,
            karigarFineGold: s.karigarGold?.totalFineGold ?? 0,
            supplierFineGold: s.supplierGold?.totalFineGold ?? 0,
            netFineGold: s.netPosition.totalFineGold,
            estimatedValue: s.netPosition.estimatedValue,
        }));

        // Add totals row
        storeData.push({
            storeName: '--- TOTAL ---',
            storeCode: '',
            inventoryGrossWeight: 0,
            inventoryNetWeight: 0,
            inventoryFineGold: position.totals.inventoryFineGold,
            karigarFineGold: position.totals.karigarFineGold,
            supplierFineGold: position.totals.supplierOwedFineGold,
            netFineGold: position.totals.netFineGold,
            estimatedValue: position.totals.totalEstimatedValue,
        });

        return [
            {
                sheetName: 'Metal Position',
                data: storeData,
                columns: [
                    { header: 'Store', key: 'storeName', width: 20, format: 'text' },
                    { header: 'Code', key: 'storeCode', width: 12, format: 'text' },
                    { header: 'Inv. Gross (g)', key: 'inventoryGrossWeight', width: 16, format: 'weight' },
                    { header: 'Inv. Net (g)', key: 'inventoryNetWeight', width: 16, format: 'weight' },
                    { header: 'Inv. Fine Gold (g)', key: 'inventoryFineGold', width: 18, format: 'weight' },
                    { header: 'Karigar Fine (g)', key: 'karigarFineGold', width: 16, format: 'weight' },
                    { header: 'Supplier Owed (g)', key: 'supplierFineGold', width: 16, format: 'weight' },
                    { header: 'Net Fine Gold (g)', key: 'netFineGold', width: 16, format: 'weight' },
                    { header: 'Estimated Value', key: 'estimatedValue', width: 18, format: 'currency' },
                ],
            },
        ];
    } catch (error) {
        logger.warn('Failed to export metal position', { error });
        return [
            {
                sheetName: 'Metal Position',
                data: [{ storeName: 'Error generating metal position', storeCode: '' }],
                columns: [
                    { header: 'Store', key: 'storeName', width: 40, format: 'text' },
                    { header: 'Code', key: 'storeCode', width: 12, format: 'text' },
                ],
            },
        ];
    }
}

// ============================================================================
// FILE GENERATION & UPLOAD
// ============================================================================

/**
 * Generate an .xlsx file from multiple SheetData arrays, save locally.
 */
export async function generateExcelFile(
    sheets: SheetData[],
    fileName: string
): Promise<ExportResult> {
    const dateStr = formatDateStr(new Date());
    const dirPath = path.join(SNAPSHOT_DIR, dateStr);
    await fsPromises.mkdir(dirPath, { recursive: true });

    const filePath = path.join(dirPath, fileName);
    const wb = createStyledWorkbook(sheets);

    // Write to buffer then save (non-blocking)
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    await fsPromises.writeFile(filePath, buf);

    const totalRows = sheets.reduce((sum, s) => sum + s.data.length, 0);

    logger.info(`Excel file generated: ${filePath}`, {
        sheets: sheets.length,
        totalRows,
    });

    return {
        filePath,
        fileName,
        sheetsCount: sheets.length,
        rowsCount: totalRows,
    };
}

/**
 * Upload file to MinIO/S3 with 3× retry and exponential backoff.
 */
export async function uploadToMinIO(
    filePath: string,
    bucketName: string = 'daily-snapshots'
): Promise<string> {
    const maxRetries = 3;
    const delays = [1000, 2000, 4000]; // exponential backoff

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            // Dynamic import to avoid loading S3 client if not needed
            const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

            const s3Client = new S3Client({
                region: process.env.BACKUP_AWS_REGION || 'us-east-1',
                endpoint: process.env.BACKUP_S3_ENDPOINT,
                credentials: {
                    accessKeyId: process.env.BACKUP_AWS_ACCESS_KEY_ID || '',
                    secretAccessKey: process.env.BACKUP_AWS_SECRET_ACCESS_KEY || '',
                },
                forcePathStyle: true, // Required for MinIO
            });

            const fileContent = await fsPromises.readFile(filePath);
            const key = `snapshots/${path.basename(filePath)}`;

            await s3Client.send(
                new PutObjectCommand({
                    Bucket: bucketName,
                    Key: key,
                    Body: fileContent,
                    ContentType:
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    Metadata: {
                        'generated-at': new Date().toISOString(),
                        'file-size': fileContent.length.toString(),
                    },
                })
            );

            logger.info(`Snapshot uploaded to MinIO: ${key}`);
            return key;
        } catch (error) {
            logger.warn(`MinIO upload attempt ${attempt + 1}/${maxRetries} failed`, { error });
            if (attempt < maxRetries - 1) {
                await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
            } else {
                logger.error(`MinIO upload failed after ${maxRetries} attempts`, {
                    filePath,
                    error,
                });
                // Don't throw — local file still exists as backup
                return '';
            }
        }
    }
    return '';
}

/**
 * Convert SheetData arrays to flat 2D array format for Google Sheets.
 */
export function sheetsToRows(sheets: SheetData[]): { sheetName: string; rows: any[][] }[] {
    return sheets.map((sheet) => {
        const header = sheet.columns.map((c) => c.header);
        const dataRows = sheet.data.map((row) =>
            sheet.columns.map((col) => {
                const val = row[col.key];
                switch (col.format) {
                    case 'currency':
                        return toNumber(val);
                    case 'weight':
                        return toNumber(val);
                    case 'date':
                        return formatDateStr(val);
                    case 'number':
                        return toNumber(val);
                    default:
                        return val ?? '';
                }
            })
        );
        return { sheetName: sheet.sheetName, rows: [header, ...dataRows] };
    });
}
