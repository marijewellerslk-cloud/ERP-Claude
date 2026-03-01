import { z } from 'zod';

// Field configuration schema for label elements
export const labelFieldSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'barcode', 'qr', 'line', 'rectangle', 'image']),
  field: z
    .enum([
      'sku',
      'name',
      'grossWeight',
      'netWeight',
      'stoneWeight',
      'metalType',
      'purity',
      'barcode',
      'category',
      'companyName',
      'branch',
      'countryOfOrigin',
      'gemType',
      'gemWeight',
      'costPrice',
      'costRatePercentage',
      'makingCharges',
      'size',
      'logo',
      'custom',
    ])
    .optional(),
  label: z.string().optional(),
  customText: z.string().optional(),
  imageUrl: z.string().optional(), // For logo or custom images
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().min(0.1),
  height: z.number().min(0.1),
  fontSize: z.number().min(4).max(72).optional(),
  fontFamily: z.string().optional(),
  fontWeight: z.enum(['normal', 'bold']).optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  color: z.string().optional(),
  backgroundColor: z.string().optional(),
  borderWidth: z.number().min(0).optional(),
  borderColor: z.string().optional(),
});

export const createLabelTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),

  // Page configuration
  pageSize: z.enum(['A4', 'letter', 'custom']).default('A4'),
  pageWidth: z.number().min(5).optional(),
  pageHeight: z.number().min(5).optional(),
  pageOrientation: z.enum(['portrait', 'landscape']).default('portrait'),

  // Label configuration
  labelWidth: z.number().min(5).max(500),
  labelHeight: z.number().min(5).max(500),
  labelsPerRow: z.number().min(1).max(10).default(2),
  labelsPerColumn: z.number().min(1).max(20).default(4),

  // Margins and spacing
  marginTop: z.number().min(0).max(100).default(10),
  marginBottom: z.number().min(0).max(100).default(10),
  marginLeft: z.number().min(0).max(100).default(10),
  marginRight: z.number().min(0).max(100).default(10),
  horizontalSpacing: z.number().min(0).max(50).default(5),
  verticalSpacing: z.number().min(0).max(50).default(5),

  // Label content configuration
  fields: z.array(labelFieldSchema).optional().default([]),

  // Style configuration
  companyName: z.string().max(255).default('MARI Jewellers'),
  showCompanyHeader: z.boolean().default(true),
  headerFontSize: z.number().min(8).max(48).default(16),
  showBorder: z.boolean().default(true),
  borderWidth: z.number().min(0).max(10).default(2),
  borderColor: z.string().default('#000000'),
  borderRadius: z.number().min(0).max(50).default(4),
  backgroundColor: z.string().default('#FFFFFF'),

  // Template metadata
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const updateLabelTemplateSchema = createLabelTemplateSchema.partial().extend({
  fields: z.array(labelFieldSchema).optional(),
});

export type CreateLabelTemplateInput = z.infer<typeof createLabelTemplateSchema>;
export type UpdateLabelTemplateInput = z.infer<typeof updateLabelTemplateSchema>;
export type LabelField = z.infer<typeof labelFieldSchema>;
