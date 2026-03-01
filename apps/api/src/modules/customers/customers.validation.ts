import { z } from 'zod';

// Customer address schema
export const customerAddressSchema = z.object({
  addressType: z.enum(['home', 'work', 'billing', 'shipping']),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1).optional(), // Made optional as state/province might not always be strictly required or known
  pincode: z.string().min(1), // Removed strict length checks to allow for various formats including SL's 5 digits
  isDefault: z.boolean().default(false),
});

// Create customer schema
export const createCustomerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().min(10),
  whatsapp: z.string().optional(),
  dateOfBirth: z.string().optional(), // Removed strict datetime() to allow YYYY-MM-DD
  anniversary: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  gstNumber: z.string().optional(), // VAT/TIN/SVAT number
  notes: z.string().optional(),
  addresses: z.array(customerAddressSchema).optional(),
  whatsappOptIn: z.boolean().optional(),
  emailOptIn: z.boolean().optional(),
});

// Update customer schema
export const updateCustomerSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().min(10).optional(),
  whatsapp: z.string().optional(),
  dateOfBirth: z.string().optional(),
  anniversary: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  gstNumber: z.string().optional(),
  tier: z.enum(['bronze', 'silver', 'gold', 'platinum']).optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
  whatsappOptIn: z.boolean().optional(),
  emailOptIn: z.boolean().optional(),
});

// Loyalty transaction schema
export const loyaltyTransactionSchema = z.object({
  points: z.number().int(),
  type: z.enum(['earned', 'redeemed', 'expired', 'adjusted']),
  notes: z.string().optional(),
});

export type CustomerAddressInput = z.infer<typeof customerAddressSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type LoyaltyTransactionInput = z.infer<typeof loyaltyTransactionSchema>;
