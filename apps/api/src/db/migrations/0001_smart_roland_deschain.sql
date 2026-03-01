CREATE TABLE "customer_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"address_type" varchar(50) NOT NULL,
	"address_line1" varchar(255) NOT NULL,
	"address_line2" varchar(255),
	"city" varchar(100) NOT NULL,
	"state" varchar(100) NOT NULL,
	"pincode" varchar(10) NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"customer_code" varchar(50) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100),
	"email" varchar(255),
	"phone" varchar(20) NOT NULL,
	"whatsapp" varchar(20),
	"date_of_birth" timestamp,
	"gender" varchar(20),
	"address" text,
	"city" varchar(100),
	"state" varchar(100),
	"pincode" varchar(10),
	"gst_number" varchar(15),
	"loyalty_points" integer DEFAULT 0 NOT NULL,
	"tier" varchar(50) DEFAULT 'silver',
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "customers_store_id_customer_code_unique" UNIQUE("store_id","customer_code")
);
--> statement-breakpoint
CREATE TABLE "gold_loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"loan_number" varchar(100) NOT NULL,
	"customer_id" uuid NOT NULL,
	"application_date" timestamp DEFAULT now() NOT NULL,
	"loan_amount" numeric(12, 2) NOT NULL,
	"interest_rate" numeric(5, 2) NOT NULL,
	"tenure" integer NOT NULL,
	"monthly_emi" numeric(12, 2),
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"maturity_date" timestamp,
	"approved_by" uuid,
	"approved_at" timestamp,
	"closed_at" timestamp,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "gold_loans_store_id_loan_number_unique" UNIQUE("store_id","loan_number")
);
--> statement-breakpoint
CREATE TABLE "gold_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" timestamp NOT NULL,
	"gold_type" varchar(50) NOT NULL,
	"purity" varchar(50) NOT NULL,
	"rate_per_gram" numeric(10, 2) NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gold_rates_date_gold_type_purity_unique" UNIQUE("date","gold_type","purity")
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"inventory_item_id" uuid,
	"item_description" varchar(255) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"making_charges" numeric(12, 2) DEFAULT '0' NOT NULL,
	"wastage_charges" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	"gold_weight" numeric(10, 3),
	"gold_purity" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"invoice_number" varchar(100) NOT NULL,
	"customer_id" uuid,
	"invoice_date" timestamp DEFAULT now() NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"final_amount" numeric(12, 2) NOT NULL,
	"gold_rate_id" uuid,
	"payment_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "invoices_store_id_invoice_number_unique" UNIQUE("store_id","invoice_number")
);
--> statement-breakpoint
CREATE TABLE "loan_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"payment_date" timestamp DEFAULT now() NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_type" varchar(50) NOT NULL,
	"principal_amount" numeric(12, 2) NOT NULL,
	"interest_amount" numeric(12, 2) NOT NULL,
	"penalty_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"outstanding_balance" numeric(12, 2) NOT NULL,
	"transaction_reference" varchar(255),
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"release_date" timestamp DEFAULT now() NOT NULL,
	"total_paid" numeric(12, 2) NOT NULL,
	"total_interest" numeric(12, 2) NOT NULL,
	"penalty" numeric(12, 2) DEFAULT '0' NOT NULL,
	"released_by" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"transaction_date" timestamp DEFAULT now() NOT NULL,
	"points" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"reference_type" varchar(50),
	"reference_id" uuid,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"payment_date" timestamp DEFAULT now() NOT NULL,
	"payment_method" varchar(50) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"transaction_reference" varchar(255),
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pledged_gold" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"item_description" varchar(255) NOT NULL,
	"gross_weight" numeric(10, 3) NOT NULL,
	"net_weight" numeric(10, 3) NOT NULL,
	"purity" varchar(50) NOT NULL,
	"gold_value" numeric(12, 2) NOT NULL,
	"appraisal_value" numeric(12, 2) NOT NULL,
	"photos" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"quotation_number" varchar(100) NOT NULL,
	"customer_id" uuid,
	"quotation_date" timestamp DEFAULT now() NOT NULL,
	"valid_until" timestamp NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quotations_store_id_quotation_number_unique" UNIQUE("store_id","quotation_number")
);
--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gold_loans" ADD CONSTRAINT "gold_loans_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gold_loans" ADD CONSTRAINT "gold_loans_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gold_loans" ADD CONSTRAINT "gold_loans_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gold_loans" ADD CONSTRAINT "gold_loans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gold_rates" ADD CONSTRAINT "gold_rates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_gold_rate_id_gold_rates_id_fk" FOREIGN KEY ("gold_rate_id") REFERENCES "public"."gold_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_loan_id_gold_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."gold_loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_releases" ADD CONSTRAINT "loan_releases_loan_id_gold_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."gold_loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_releases" ADD CONSTRAINT "loan_releases_released_by_users_id_fk" FOREIGN KEY ("released_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pledged_gold" ADD CONSTRAINT "pledged_gold_loan_id_gold_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."gold_loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_phone_idx" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "customers_email_idx" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "customers_store_idx" ON "customers" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "gold_loans_store_idx" ON "gold_loans" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "gold_loans_customer_idx" ON "gold_loans" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "gold_loans_status_idx" ON "gold_loans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gold_rates_date_idx" ON "gold_rates" USING btree ("date");--> statement-breakpoint
CREATE INDEX "invoices_store_idx" ON "invoices" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "invoices_customer_idx" ON "invoices" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "invoices_date_idx" ON "invoices" USING btree ("invoice_date");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "loan_payments_loan_idx" ON "loan_payments" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "loan_payments_date_idx" ON "loan_payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "loyalty_transactions_customer_idx" ON "loyalty_transactions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "loyalty_transactions_date_idx" ON "loyalty_transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "payments_invoice_idx" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payments_date_idx" ON "payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "quotations_store_idx" ON "quotations" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "quotations_customer_idx" ON "quotations" USING btree ("customer_id");