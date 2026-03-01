import { z } from 'zod';

// Create Supplier Schema
// Create Supplier Schema
export const createSupplierSchema = z.object({
  businessName: z.string().min(1, 'Business name is required').max(255),
  contactPersonName: z.string().max(255).nullable().optional(),
  email: z.string().email('Invalid email').max(255).nullable().optional().or(z.literal('')),
  phone: z.string().min(1, 'Phone is required').max(20),
  whatsapp: z.string().max(20).nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(100).nullable().optional(),
  pincode: z.string().max(10).nullable().optional(),
  gstNumber: z.string().max(20).nullable().optional(), // VAT/SVAT
  panNumber: z.string().max(20).nullable().optional(), // BR Number / TIN - Relaxed length from 10 to 20
  supplierType: z
    .enum(['wholesaler', 'manufacturer', 'artisan', 'broker', 'other'])
    .default('wholesaler'),
  specialization: z.array(z.string()).nullable().optional(),
  bankName: z.string().max(255).nullable().optional(),
  accountNumber: z.string().max(50).nullable().optional(),
  ifscCode: z.string().max(20).nullable().optional(), // Bank Code / Branch Code
  upiId: z.string().max(100).nullable().optional(),
  defaultCreditDays: z.number().int().nonnegative().default(0),
  creditLimit: z.number().nonnegative().default(0),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().nullable().optional(),
  contacts: z
    .array(
      z.object({
        name: z.string().min(1, 'Contact name is required').max(255),
        phone: z.string().min(1, 'Contact phone is required').max(20),
        designation: z.string().max(100).nullable().optional(),
        email: z.string().email('Invalid email').max(255).nullable().optional().or(z.literal('')),
        isPrimary: z.boolean().default(false),
      })
    )
    .optional(),
});

// Update Supplier Schema
export const updateSupplierSchema = z.object({
  businessName: z.string().min(1).max(255).optional(),
  contactPersonName: z.string().max(255).nullable().optional(),
  email: z.string().email().max(255).nullable().optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  whatsapp: z.string().max(20).nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(100).nullable().optional(),
  pincode: z.string().max(10).nullable().optional(),
  gstNumber: z.string().max(20).nullable().optional(),
  panNumber: z.string().max(20).nullable().optional(),
  supplierType: z.enum(['wholesaler', 'manufacturer', 'artisan', 'broker', 'other']).optional(),
  specialization: z.array(z.string()).nullable().optional(),
  bankName: z.string().max(255).nullable().optional(),
  accountNumber: z.string().max(50).nullable().optional(),
  ifscCode: z.string().max(20).nullable().optional(),
  upiId: z.string().max(100).nullable().optional(),
  defaultCreditDays: z.number().int().nonnegative().nullable().optional(),
  creditLimit: z.number().nonnegative().nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  contacts: z
    .array(
      z.object({
        id: z.string().optional(), // For updating existing contacts
        name: z.string().min(1).max(255),
        phone: z.string().min(1).max(20),
        designation: z.string().max(100).nullable().optional(),
        email: z.string().email().max(255).nullable().optional().or(z.literal('')),
        isPrimary: z.boolean().default(false),
      })
    )
    .optional(),
});

// List Suppliers Query Schema
export const listSuppliersQuerySchema = z.object({
  search: z.string().optional(),
  supplierType: z.enum(['wholesaler', 'manufacturer', 'artisan', 'broker', 'other']).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
});

// Settle Balance Schema
export const settleBalanceSchema = z.object({
  settlementType: z.enum(['monetary', 'gold']).default('monetary'),

  // Monetary Settlement Fields
  amount: z.number().nonnegative().optional(), // Required if type is monetary
  paymentMethod: z.string().optional(), // Required if type is monetary
  paymentReference: z.string().optional(),

  // Gold Settlement Fields
  goldWeightGrams: z.number().nonnegative().optional(), // Required if type is gold
  goldPurity: z.number().min(0).max(1).optional(), // Required if type is gold

  // Common Fields
  notes: z.string().optional(),
  transactionDate: z.string().optional(),
}).refine((data) => {
  if (data.settlementType === 'monetary') {
    return data.amount !== undefined && data.paymentMethod !== undefined;
  }
  if (data.settlementType === 'gold') {
    return data.goldWeightGrams !== undefined;
  }
  return true;
}, {
  message: "Invalid settlement data for selected type",
  path: ["settlementType"]
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type ListSuppliersQuery = z.infer<typeof listSuppliersQuerySchema>;
export type SettleBalanceInput = z.infer<typeof settleBalanceSchema>;
