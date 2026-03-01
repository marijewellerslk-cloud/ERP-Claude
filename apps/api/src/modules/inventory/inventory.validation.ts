import { z } from 'zod';

// Batch creation schema
export const createBatchSchema = z.object({
  supplierId: z.string().uuid('Supplier is required'),
  purchaseDate: z.string().datetime(),
  expectedTotalItems: z.number().int().positive(),
  expectedTotalWeight: z.number().positive(),
  // Purchase type
  purchaseType: z.enum(['monetary', 'gold_exchange']).default('monetary'),
  // Monetary purchase fields (required only if purchaseType is 'monetary')
  totalCost: z.number().positive('Total cost is required').optional(),
  goldRatePerGram: z.number().positive('Gold rate is required').optional(),
  initialPaymentAmount: z.number().nonnegative().default(0),
  paymentMethod: z.enum(['cash', 'cheque', 'bank_transfer', 'upi', 'card', 'adjustment']).optional(),
  transactionReference: z.string().optional(),
  creditDays: z.number().int().nonnegative().optional(),
  // Gold exchange fields (required only if purchaseType is 'gold_exchange')
  goldGivenWeight: z.number().positive().optional(), // Gold given to supplier
  goldGivenPurity: z.number().positive().optional(), // Purity (22, 18, etc.)
  goldGivenValue: z.number().nonnegative().optional(), // Calculated value of gold given
  goldBalancePaid: z.number().nonnegative().optional(), // Any additional cash paid
  goldBalanceReceived: z.number().nonnegative().optional(), // Any cash received back
  notes: z.string().optional(),
  // Branch allocation: admin/owner can specify target store
  targetStoreId: z.string().uuid().optional(),
}).refine((data) => {
  // If monetary purchase, require totalCost and goldRatePerGram
  if (data.purchaseType === 'monetary') {
    return data.totalCost && data.goldRatePerGram;
  }
  // If gold exchange, require goldGivenWeight
  if (data.purchaseType === 'gold_exchange') {
    return data.goldGivenWeight && data.goldGivenWeight > 0;
  }
  return true;
}, {
  message: 'Missing required fields for purchase type',
});

// Stone details schema
export const stoneSchema = z.object({
  stoneType: z.string().min(1),
  count: z.number().int().positive(),
  totalWeight: z.number().positive().optional(),
  averageWeight: z.number().positive().optional(),
  shape: z.string().optional(),
  color: z.string().optional(),
  clarity: z.string().optional(),
  cutGrade: z.string().optional(),
  certificationNumber: z.string().optional(),
  certificationAgency: z.string().optional(),
  pricePerCarat: z.number().positive().optional(),
});

// Inventory item creation schema
export const createInventoryItemSchema = z.object({
  batchId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  itemType: z.enum(['finished_goods', 'raw_material', 'semi_finished']),
  metalType: z.enum(['gold', 'silver', 'platinum', 'diamond', 'other']).optional(),
  purity: z.string().optional(),
  grossWeight: z.number().positive(),
  netWeight: z.number().positive(),
  stoneWeight: z.number().nonnegative().optional().default(0),
  makingCharges: z.number().nonnegative().optional(),
  wastagePercentage: z.number().nonnegative().optional(),
  // Cost calculation fields
  costCalculationMethod: z.enum(['rate_based', 'making_charges']).optional(),
  costRatePercentage: z.number().nonnegative().optional(),
  calculatedCost: z.number().nonnegative().optional(),
  dimensions: z.record(z.any()).optional(), // JSONB field for flexible dimensions
  isHallmarked: z.boolean().default(false),
  hallmarkNumber: z.string().optional(),
  huidNumber: z.string().optional(),
  certificationNumber: z.string().optional(),
  certificationAgency: z.string().optional(),
  certificationDate: z.string().datetime().optional(),
  imageUrls: z.array(z.string().url()).optional(),
  stones: z.array(stoneSchema).optional(),
  location: z.string().optional(),
});

// Batch completion schema (strict validation - no discrepancy acceptance)
export const completeBatchSchema = z.object({
  // No fields needed - validation happens in service layer
});

// Category creation schema
export const createCategorySchema = z.object({
  name: z.string().min(1),
  parentId: z.string().uuid().optional(),
  description: z.string().optional(),
  // Dimension requirements
  requiresLength: z.boolean().optional(),
  requiresWidth: z.boolean().optional(),
  requiresHeight: z.boolean().optional(),
  requiresInternalSize: z.boolean().optional(),
  requiresRingSize: z.boolean().optional(),
});

// Record batch payment schema
export const recordBatchPaymentSchema = z.object({
  amount: z.number().positive('Payment amount must be greater than 0'),
  paymentMethod: z.enum(['cash', 'cheque', 'bank_transfer', 'upi', 'card', 'adjustment']),
  paymentDate: z.string().datetime().optional(),
  transactionReference: z.string().optional(),
  notes: z.string().optional(),
});

// Update inventory item schema (all fields optional for partial updates)
export const updateInventoryItemSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  metalType: z.enum(['gold', 'silver', 'platinum', 'diamond', 'other']).optional(),
  purity: z.string().optional(),
  grossWeight: z.number().positive().optional(),
  netWeight: z.number().positive().optional(),
  stoneWeight: z.number().nonnegative().optional(),
  makingCharges: z.number().nonnegative().optional(),
  wastagePercentage: z.number().nonnegative().optional(),
  costCalculationMethod: z.enum(['rate_based', 'making_charges']).optional(),
  costRatePercentage: z.number().nonnegative().optional(),
  calculatedCost: z.number().nonnegative().optional(),
  dimensions: z.record(z.any()).optional(),
  isHallmarked: z.boolean().optional(),
  hallmarkNumber: z.string().optional(),
  huidNumber: z.string().optional(),
  certificationNumber: z.string().optional(),
  certificationAgency: z.string().optional(),
  certificationDate: z.string().datetime().optional().nullable(),
  imageUrls: z.array(z.string().url()).optional(),
  stones: z.array(stoneSchema).optional(),
  isActive: z.boolean().optional(),
});

// Update batch item weights schema (for review page inline editing)
export const updateBatchItemSchema = z.object({
  grossWeight: z.number().positive().optional(),
  netWeight: z.number().positive().optional(),
  stoneWeight: z.number().nonnegative().optional(),
});

// Update batch schema
export const updateBatchSchema = z.object({
  supplierId: z.string().uuid().optional(),
  purchaseDate: z.string().datetime().optional(),
  expectedTotalItems: z.number().int().positive().optional(),
  expectedTotalWeight: z.number().positive().optional(),
  notes: z.string().optional(),
  // Financial fields for monetary purchases
  totalCost: z.number().positive().optional(),
  goldRatePerGram: z.number().positive().optional(),
  // Gold exchange fields
  goldGivenWeight: z.number().positive().optional(),
  goldGivenPurity: z.number().positive().optional(),
});

// Delete batch item schema (requires reason)
export const deleteBatchItemSchema = z.object({
  reason: z.string().min(10, 'Deletion reason must be at least 10 characters'),
});

// Transfer schemas
export const createTransferSchema = z.object({
  destinationStoreId: z.string().uuid(),
  items: z.array(z.object({
    inventoryItemId: z.string().uuid(),
    quantity: z.number().int().positive().default(1),
  })).min(1, 'At least one item must be selected for transfer'),
  notes: z.string().optional(),
});

export const receiveTransferSchema = z.object({
  transferId: z.string().uuid(),
  notes: z.string().optional(),
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;
export type CompleteBatchInput = z.infer<typeof completeBatchSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type StoneInput = z.infer<typeof stoneSchema>;
export type RecordBatchPaymentInput = z.infer<typeof recordBatchPaymentSchema>;
export type UpdateBatchItemInput = z.infer<typeof updateBatchItemSchema>;
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;
export type DeleteBatchItemInput = z.infer<typeof deleteBatchItemSchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type ReceiveTransferInput = z.infer<typeof receiveTransferSchema>;
