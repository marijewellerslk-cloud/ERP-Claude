import { z } from 'zod';

export const createStoreSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Store name is required'),
    code: z.string().min(1, 'Store code is required'),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    gstin: z.string().optional(),
    parentStoreId: z.string().uuid().optional().nullable(),
    isActive: z.boolean().optional().default(true),
    managerId: z.string().uuid().optional().nullable(),
  }),
});

export const updateStoreSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    gstin: z.string().optional(),
    parentStoreId: z.string().uuid().optional().nullable(),
    isActive: z.boolean().optional(),
    managerId: z.string().uuid().optional().nullable(),
  }),
});

export type CreateStoreInput = z.infer<typeof createStoreSchema>['body'];
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>['body'];
