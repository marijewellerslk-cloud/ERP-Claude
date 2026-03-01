import { z } from 'zod';

// Gold rate schema
export const updateGoldRateSchema = z.object({
  goldType: z.string().min(1),
  purity: z.string().min(1),
  ratePerGram: z.number().positive(),
});

// Invoice item schema
export const invoiceItemSchema = z.object({
  inventoryItemId: z.string().uuid().optional(),
  itemDescription: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  unitPrice: z.number().nonnegative(),
  makingCharges: z.number().nonnegative().default(0),
  wastageCharges: z.number().nonnegative().default(0),
  discount: z.number().nonnegative().default(0),
  taxRate: z.number().nonnegative().default(0),
  goldWeight: z.number().nonnegative().optional(), // Changed to nonnegative to allow 0
  goldPurity: z.string().optional(),
});

// Create invoice schema
export const createInvoiceSchema = z.object({
  customerId: z.string().uuid().optional(),
  invoiceDate: z.string().optional(), // Accept any date string format
  items: z.array(invoiceItemSchema).min(1),
  discountAmount: z.number().nonnegative().default(0),
  taxAmount: z.number().nonnegative().default(0),
  goldRateId: z.string().uuid().optional(),
  notes: z.string().optional(),
  // CRM fields
  purchaseOccasion: z.enum(['wedding', 'engagement', 'anniversary', 'birthday', 'festival', 'gift', 'investment', 'personal', 'other']).optional(),
  loyaltyPointsRedeemed: z.number().int().nonnegative().optional(),
  redemptionId: z.string().uuid().optional(),
});

// Add payment schema
export const addPaymentSchema = z.object({
  paymentMethod: z.enum(['cash', 'card', 'upi', 'bank_transfer', 'cheque', 'other']),
  amount: z.number().positive(),
  transactionReference: z.string().optional(),
  notes: z.string().optional(),
});

// Create quotation schema
export const createQuotationSchema = z.object({
  customerId: z.string().uuid().optional(),
  validUntil: z.string().datetime(),
  items: z.array(invoiceItemSchema).min(1),
  notes: z.string().optional(),
});

export type UpdateGoldRateInput = z.infer<typeof updateGoldRateSchema>;
export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type AddPaymentInput = z.infer<typeof addPaymentSchema>;
export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;

// Return Item Schema
export const returnItemSchema = z.object({
  inventoryItemId: z.string().uuid(),
  invoiceItemId: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
  condition: z.enum(['good', 'damaged', 'scrap']).default('good'),
  refundAmount: z.number().nonnegative(),
});

// Create Return Schema
export const createReturnSchema = z.object({
  invoiceId: z.string().uuid(),
  items: z.array(returnItemSchema).min(1),
  reason: z.string().optional(),
  refundMethod: z.enum(['cash', 'card', 'store_credit', 'bank_transfer']).optional(),
  notes: z.string().optional(),
});

// Process Return Schema
export const processReturnSchema = z.object({
  returnId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  notes: z.string().optional(),
});

export type CreateReturnInput = z.infer<typeof createReturnSchema>;
export type ProcessReturnInput = z.infer<typeof processReturnSchema>;
