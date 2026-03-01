import { z } from 'zod';

// Pledged gold item schema
export const pledgedGoldSchema = z.object({
  itemDescription: z.string().min(1),
  grossWeight: z.number().positive(),
  netWeight: z.number().positive(),
  purity: z.string().min(1),
  goldValue: z.number().positive(),
  appraisalValue: z.number().positive(),
  photos: z.array(z.string().url()).optional(),
});

// Create loan schema
export const createLoanSchema = z.object({
  customerId: z.string().uuid(),
  loanAmount: z.number().positive(),
  interestRate: z.number().positive(),
  tenure: z.number().int().positive(),
  monthlyEmi: z.number().positive().optional(),
  pledgedGoldItems: z.array(pledgedGoldSchema).min(1),
  notes: z.string().optional(),
});

// Approve loan schema
export const approveLoanSchema = z.object({
  approved: z.boolean(),
  notes: z.string().optional(),
});

// Add loan payment schema
export const addLoanPaymentSchema = z.object({
  amount: z.number().positive(),
  paymentType: z.enum(['emi', 'partial', 'full', 'interest_only']),
  transactionReference: z.string().optional(),
  notes: z.string().optional(),
});

// Release loan schema
export const releaseLoanSchema = z.object({
  totalPaid: z.number().nonnegative(),
  totalInterest: z.number().nonnegative(),
  penalty: z.number().nonnegative().default(0),
  notes: z.string().optional(),
});

export type PledgedGoldInput = z.infer<typeof pledgedGoldSchema>;
export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type ApproveLoanInput = z.infer<typeof approveLoanSchema>;
export type AddLoanPaymentInput = z.infer<typeof addLoanPaymentSchema>;
export type ReleaseLoanInput = z.infer<typeof releaseLoanSchema>;
