ALTER TABLE "inventory_batches" ADD COLUMN "purchase_type" varchar(20) DEFAULT 'monetary' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_batches" ADD COLUMN "gold_given_weight" numeric(10, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_batches" ADD COLUMN "gold_given_purity" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "inventory_batches" ADD COLUMN "gold_given_value" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_batches" ADD COLUMN "gold_balance_paid" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_batches" ADD COLUMN "gold_balance_received" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_batches" ADD COLUMN "gold_exchange_status" varchar(50) DEFAULT 'balanced';--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "gold_exchange_balance_grams" numeric(10, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "total_gold_given_in_exchange" numeric(10, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "total_gold_received_in_exchange" numeric(10, 3) DEFAULT '0' NOT NULL;