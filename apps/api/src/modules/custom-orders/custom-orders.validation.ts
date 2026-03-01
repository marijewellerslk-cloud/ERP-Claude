import { z } from 'zod';

export const createCustomOrderSchema = z.object({
  customerId: z.string().uuid(),
  orderType: z.enum([
    'ring',
    'necklace',
    'earrings',
    'bangle',
    'pendant',
    'bracelet',
    'chain',
    'set',
    'other',
  ]),
  designTitle: z.string().min(1).max(255),
  designDescription: z.string().optional(),
  customerRequirements: z.string().optional(),
  metalType: z.enum(['gold', 'silver', 'platinum', 'rose_gold', 'white_gold']).optional(),
  purity: z.string().max(20).optional(),
  estimatedWeight: z.number().positive().optional(),
  ringSize: z.string().max(20).optional(),
  bangleSize: z.string().max(20).optional(),
  chainLength: z.string().max(20).optional(),
  hasStones: z.boolean().optional(),
  stoneDetails: z.any().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  notes: z.string().optional(),
});

export const updateCustomOrderSchema = z.object({
  designTitle: z.string().min(1).max(255).optional(),
  designDescription: z.string().optional(),
  customerRequirements: z.string().optional(),
  metalType: z.enum(['gold', 'silver', 'platinum', 'rose_gold', 'white_gold']).optional(),
  purity: z.string().max(20).optional(),
  estimatedWeight: z.number().positive().optional(),
  ringSize: z.string().max(20).optional(),
  bangleSize: z.string().max(20).optional(),
  chainLength: z.string().max(20).optional(),
  hasStones: z.boolean().optional(),
  stoneDetails: z.any().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  craftsman: z.string().max(255).optional(),
  workshopNotes: z.string().optional(),
});

export const addDesignVersionSchema = z.object({
  versionName: z.string().max(255).optional(),
  sketchUrls: z.array(z.string().url()).optional(),
  cadModelUrls: z.array(z.string().url()).optional(),
  renderUrls: z.array(z.string().url()).optional(),
  designNotes: z.string().optional(),
  estimatedCost: z.number().nonnegative().optional(),
  costBreakdown: z.any().optional(),
});

export const presentDesignSchema = z.object({
  versionId: z.string().uuid(),
});

export const designFeedbackSchema = z.object({
  versionId: z.string().uuid(),
  feedback: z.string().min(1),
});

export const quoteCustomOrderSchema = z.object({
  goldRateAtQuote: z.number().positive(),
  estimatedGoldCost: z.number().nonnegative(),
  estimatedStoneCost: z.number().nonnegative().optional(),
  makingCharges: z.number().nonnegative(),
  designCharges: z.number().nonnegative().optional(),
  wastagePercentage: z.number().min(0).max(100).optional(),
  additionalCharges: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional(),
  expectedCompletionDate: z.string().optional(),
  quoteValidUntil: z.string().optional(),
});

export const approveOrderSchema = z.object({
  approvalMethod: z.enum(['in_person', 'phone', 'whatsapp', 'email']),
  advanceAmount: z.number().nonnegative().optional(),
  signedDocumentUrl: z.string().url().optional(),
});

export const startProductionSchema = z.object({
  craftsman: z.string().max(255).optional(),
  workshopNotes: z.string().optional(),
});

export const completeProductionSchema = z.object({
  actualWeight: z.number().positive().optional(),
  completionPhotos: z.array(z.string().url()).optional(),
});

export const qualityCheckSchema = z.object({
  passed: z.boolean(),
  notes: z.string().optional(),
});

export const deliverOrderSchema = z.object({
  paymentReceived: z.number().nonnegative().optional(),
  packagingPhotos: z.array(z.string().url()).optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().min(1).max(500),
});

export const addOrderItemSchema = z.object({
  itemName: z.string().min(1).max(255),
  itemType: z.string().max(100).optional(),
  quantity: z.number().int().positive().optional(),
  metalType: z.string().max(50).optional(),
  purity: z.string().max(20).optional(),
  estimatedWeight: z.number().positive().optional(),
  stoneType: z.string().max(100).optional(),
  stoneCount: z.number().int().nonnegative().optional(),
  stoneTotalWeight: z.number().nonnegative().optional(),
  stoneQuality: z.string().max(50).optional(),
  stoneSource: z.enum(['customer_provided', 'store_stock', 'to_procure']).optional(),
  size: z.string().max(50).optional(),
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
  thickness: z.number().positive().optional(),
  notes: z.string().optional(),
});

export const notifyCustomerSchema = z.object({
  stageName: z.string().min(1),
  method: z.enum(['sms', 'whatsapp', 'email', 'phone']),
});
