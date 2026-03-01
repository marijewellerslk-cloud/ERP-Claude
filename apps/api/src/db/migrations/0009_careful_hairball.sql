ALTER TABLE "supplier_account_transactions" ADD COLUMN "ledger_type" varchar(20) DEFAULT 'monetary' NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_account_transactions" ADD COLUMN "gold_debit" numeric(10, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_account_transactions" ADD COLUMN "gold_credit" numeric(10, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_account_transactions" ADD COLUMN "gold_balance" numeric(10, 3) NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_account_transactions" ADD COLUMN "payment_method" varchar(50);--> statement-breakpoint
ALTER TABLE "supplier_account_transactions" ADD COLUMN "payment_reference" varchar(255);--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "gold_balance_grams" numeric(10, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "total_gold_received" numeric(10, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "total_gold_returned" numeric(10, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
CREATE INDEX "supplier_account_transactions_ledger_type_idx" ON "supplier_account_transactions" USING btree ("ledger_type");