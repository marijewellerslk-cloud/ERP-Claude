CREATE TABLE "supplier_account_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"transaction_type" varchar(50) NOT NULL,
	"reference_type" varchar(50) NOT NULL,
	"reference_id" uuid,
	"debit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"credit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"balance" numeric(12, 2) NOT NULL,
	"description" text NOT NULL,
	"transaction_date" timestamp NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "current_balance" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "total_lifetime_purchases" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "total_lifetime_payments" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "last_purchase_date" timestamp;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "last_payment_date" timestamp;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "account_status" varchar(20) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_account_transactions" ADD CONSTRAINT "supplier_account_transactions_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_account_transactions" ADD CONSTRAINT "supplier_account_transactions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_account_transactions" ADD CONSTRAINT "supplier_account_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "supplier_account_transactions_supplier_idx" ON "supplier_account_transactions" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_account_transactions_store_idx" ON "supplier_account_transactions" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "supplier_account_transactions_date_idx" ON "supplier_account_transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "supplier_account_transactions_type_idx" ON "supplier_account_transactions" USING btree ("transaction_type");--> statement-breakpoint
CREATE INDEX "supplier_account_transactions_reference_idx" ON "supplier_account_transactions" USING btree ("reference_type","reference_id");