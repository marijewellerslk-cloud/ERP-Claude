-- Add sold items tracking fields to inventory_items
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "status" varchar(50) DEFAULT 'available' NOT NULL;
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "sold_at" timestamp;
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "sold_price" decimal(12, 2);
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "sold_invoice_id" uuid REFERENCES "invoices"("id");
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "profit" decimal(12, 2);
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "daily_gold_rate" decimal(12, 2);

-- Create index for status
CREATE INDEX IF NOT EXISTS "inventory_items_status_idx" ON "inventory_items" ("status");
CREATE INDEX IF NOT EXISTS "inventory_items_sold_at_idx" ON "inventory_items" ("sold_at");
