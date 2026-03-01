import { z } from 'zod';

export const createRepairSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  repairType: z.enum([
    'repair',
    'resize',
    'repolish',
    'cleaning',
    'stone_replacement',
    'chain_repair',
    'clasp_repair',
    'engraving',
    'other',
  ]),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
  itemDescription: z.string().min(1, 'Item description is required'),
  metalType: z.enum(['gold', 'silver', 'platinum', 'other']).optional(),
  purity: z.string().optional(),
  estimatedWeight: z.number().positive().optional(),
  problemDescription: z.string().min(1, 'Problem description is required'),
  customerInstructions: z.string().optional(),
  expectedCompletionDate: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
  notes: z.string().optional(),
  intakePhotos: z.array(z.string().url()).optional(),
});

export const updateRepairSchema = z.object({
  repairType: z.enum([
    'repair',
    'resize',
    'repolish',
    'cleaning',
    'stone_replacement',
    'chain_repair',
    'clasp_repair',
    'engraving',
    'other',
  ]).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  itemDescription: z.string().min(1).optional(),
  metalType: z.enum(['gold', 'silver', 'platinum', 'other']).optional(),
  purity: z.string().optional(),
  estimatedWeight: z.number().positive().optional(),
  problemDescription: z.string().optional(),
  customerInstructions: z.string().optional(),
  assessmentNotes: z.string().optional(),
  estimatedCost: z.number().nonnegative().optional(),
  laborCharges: z.number().nonnegative().optional(),
  materialCost: z.number().nonnegative().optional(),
  additionalCharges: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional(),
  expectedCompletionDate: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
  assignedTo: z.string().uuid().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  intakePhotos: z.array(z.string().url()).optional(),
  completionPhotos: z.array(z.string().url()).optional(),
});

export const assessRepairSchema = z.object({
  assessmentNotes: z.string().min(1, 'Assessment notes are required'),
  laborCharges: z.number().nonnegative('Labor charges must be positive'),
  materialCost: z.number().nonnegative().optional(),
  additionalCharges: z.number().nonnegative().optional(),
  estimatedCost: z.number().positive('Estimated cost must be positive'),
  expectedCompletionDate: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
});

export const approveQuotationSchema = z.object({
  approvalMethod: z.enum(['in_person', 'phone', 'whatsapp', 'email']),
  advanceAmount: z.number().nonnegative().optional(),
});

export const startRepairSchema = z.object({
  assignedTo: z.string().uuid().optional(),
});

export const completeRepairSchema = z.object({
  completionPhotos: z.array(z.string().url()).optional(),
});

export const deliverRepairSchema = z.object({
  paymentReceived: z.number().nonnegative().optional(),
});

export const cancelRepairSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required'),
});

export const addRepairItemSchema = z.object({
  itemName: z.string().min(1, 'Item name is required'),
  itemType: z.string().optional(),
  metalType: z.enum(['gold', 'silver', 'platinum', 'other']).optional(),
  purity: z.string().optional(),
  weight: z.number().positive().optional(),
  issueDescription: z.string().optional(),
  laborCost: z.number().nonnegative().optional(),
  materialCost: z.number().nonnegative().optional(),
});

export const notifyCustomerSchema = z.object({
  stageName: z.string().min(1),
  method: z.enum(['sms', 'whatsapp', 'email', 'call']),
});

export type CreateRepairInput = z.infer<typeof createRepairSchema>;
export type UpdateRepairInput = z.infer<typeof updateRepairSchema>;
export type AssessRepairInput = z.infer<typeof assessRepairSchema>;
export type ApproveQuotationInput = z.infer<typeof approveQuotationSchema>;
