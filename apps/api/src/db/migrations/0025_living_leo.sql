ALTER TABLE "inventory_transfer_items" ADD COLUMN "weight" numeric(10, 3);--> statement-breakpoint
ALTER TABLE "inventory_transfer_items" ADD COLUMN "rate" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "inventory_transfer_items" ADD COLUMN "value" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD COLUMN "total_weight" numeric(10, 3);--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD COLUMN "total_value" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD COLUMN "gold_rate" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD COLUMN "invoice_number" varchar(100);--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD COLUMN "invoice_date" timestamp;--> statement-breakpoint
CREATE INDEX "inventory_transfers_invoice_idx" ON "inventory_transfers" USING btree ("invoice_number");