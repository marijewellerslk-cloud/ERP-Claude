-- Migration: Add ROI and margin analysis fields to invoice_items
-- This enables tracking profit margins, metal margins, and ROI per sold item

-- Add ROI and margin fields to invoice_items
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "unit_cost" decimal(12, 2);
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "metal_cost_at_sale" decimal(12, 2);
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "metal_margin_grams" decimal(10, 4);
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "holding_period_days" integer;
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "effective_roi" decimal(8, 4);
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "gross_margin" decimal(12, 2);
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "gross_margin_percent" decimal(8, 4);

-- Add index for margin analysis queries
CREATE INDEX IF NOT EXISTS "invoice_items_margin_idx" ON "invoice_items" ("gross_margin_percent");
CREATE INDEX IF NOT EXISTS "invoice_items_holding_idx" ON "invoice_items" ("holding_period_days");
