CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"account_code" varchar(50) NOT NULL,
	"account_name" varchar(255) NOT NULL,
	"account_type" varchar(50) NOT NULL,
	"account_sub_type" varchar(50),
	"parent_account_id" uuid,
	"level" integer DEFAULT 1 NOT NULL,
	"normal_balance" varchar(10) NOT NULL,
	"opening_balance" numeric(15, 2) DEFAULT '0',
	"opening_balance_date" timestamp,
	"current_balance" numeric(15, 2) DEFAULT '0',
	"gst_applicable" boolean DEFAULT false,
	"gst_rate" numeric(5, 2),
	"hsn_sac_code" varchar(20),
	"is_system_account" boolean DEFAULT false,
	"is_active" boolean DEFAULT true NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_store_id_account_code_unique" UNIQUE("store_id","account_code")
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"bank_name" varchar(255),
	"branch_name" varchar(255),
	"account_number" varchar(50),
	"ifsc_code" varchar(20),
	"account_holder_name" varchar(255),
	"bank_account_type" varchar(30) NOT NULL,
	"current_balance" numeric(15, 2) DEFAULT '0',
	"last_reconciled" timestamp,
	"reconciled_balance" numeric(15, 2),
	"credit_limit" numeric(15, 2),
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_register" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"register_date" timestamp NOT NULL,
	"opening_balance" numeric(12, 2) NOT NULL,
	"opening_time" timestamp NOT NULL,
	"opened_by" uuid NOT NULL,
	"closing_balance" numeric(12, 2),
	"closing_time" timestamp,
	"closed_by" uuid,
	"total_cash_sales" numeric(12, 2) DEFAULT '0',
	"total_cash_received" numeric(12, 2) DEFAULT '0',
	"total_cash_expenses" numeric(12, 2) DEFAULT '0',
	"total_cash_payments" numeric(12, 2) DEFAULT '0',
	"expected_closing_balance" numeric(12, 2),
	"variance" numeric(12, 2),
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp,
	"variance_explanation" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cash_register_store_id_register_date_unique" UNIQUE("store_id","register_date")
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"expense_number" varchar(50) NOT NULL,
	"expense_date" timestamp NOT NULL,
	"expense_account_id" uuid NOT NULL,
	"paid_from_account_id" uuid,
	"payment_method" varchar(30) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"gst_amount" numeric(12, 2),
	"total_amount" numeric(12, 2) NOT NULL,
	"vendor_name" varchar(255),
	"vendor_gstin" varchar(20),
	"invoice_number" varchar(100),
	"invoice_date" timestamp,
	"description" text NOT NULL,
	"category" varchar(100),
	"receipt_urls" jsonb,
	"journal_entry_id" uuid,
	"approval_status" varchar(20) DEFAULT 'approved',
	"approved_by" uuid,
	"approved_at" timestamp,
	"is_recurring" boolean DEFAULT false,
	"recurring_frequency" varchar(20),
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"period_name" varchar(100) NOT NULL,
	"period_type" varchar(20) NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"closed_at" timestamp,
	"closed_by" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"entry_number" varchar(50) NOT NULL,
	"entry_date" timestamp NOT NULL,
	"entry_type" varchar(50) NOT NULL,
	"reference_type" varchar(50),
	"reference_id" uuid,
	"reference_number" varchar(100),
	"total_debit" numeric(15, 2) NOT NULL,
	"total_credit" numeric(15, 2) NOT NULL,
	"narration" text,
	"gst_amount" numeric(12, 2),
	"cgst_amount" numeric(12, 2),
	"sgst_amount" numeric(12, 2),
	"igst_amount" numeric(12, 2),
	"status" varchar(20) DEFAULT 'posted' NOT NULL,
	"reversed_entry_id" uuid,
	"posted_at" timestamp,
	"posted_by" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entry_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"debit_amount" numeric(15, 2) DEFAULT '0',
	"credit_amount" numeric(15, 2) DEFAULT '0',
	"party_type" varchar(30),
	"party_id" uuid,
	"description" text,
	"cost_center" varchar(100),
	"gst_rate" numeric(5, 2),
	"gst_amount" numeric(12, 2),
	"line_order" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_register" ADD CONSTRAINT "cash_register_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_register" ADD CONSTRAINT "cash_register_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_register" ADD CONSTRAINT "cash_register_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_register" ADD CONSTRAINT "cash_register_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_expense_account_id_accounts_id_fk" FOREIGN KEY ("expense_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paid_from_account_id_bank_accounts_id_fk" FOREIGN KEY ("paid_from_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_store_idx" ON "accounts" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "accounts_code_idx" ON "accounts" USING btree ("account_code");--> statement-breakpoint
CREATE INDEX "accounts_type_idx" ON "accounts" USING btree ("account_type");--> statement-breakpoint
CREATE INDEX "bank_accounts_store_idx" ON "bank_accounts" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "bank_accounts_account_idx" ON "bank_accounts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "bank_accounts_type_idx" ON "bank_accounts" USING btree ("bank_account_type");--> statement-breakpoint
CREATE INDEX "cash_register_store_idx" ON "cash_register" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "cash_register_date_idx" ON "cash_register" USING btree ("register_date");--> statement-breakpoint
CREATE INDEX "cash_register_status_idx" ON "cash_register" USING btree ("status");--> statement-breakpoint
CREATE INDEX "expenses_store_idx" ON "expenses" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "expenses_number_idx" ON "expenses" USING btree ("expense_number");--> statement-breakpoint
CREATE INDEX "expenses_date_idx" ON "expenses" USING btree ("expense_date");--> statement-breakpoint
CREATE INDEX "expenses_category_idx" ON "expenses" USING btree ("category");--> statement-breakpoint
CREATE INDEX "expenses_account_idx" ON "expenses" USING btree ("expense_account_id");--> statement-breakpoint
CREATE INDEX "financial_periods_store_idx" ON "financial_periods" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "financial_periods_date_idx" ON "financial_periods" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "financial_periods_status_idx" ON "financial_periods" USING btree ("status");--> statement-breakpoint
CREATE INDEX "journal_entries_store_idx" ON "journal_entries" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "journal_entries_number_idx" ON "journal_entries" USING btree ("entry_number");--> statement-breakpoint
CREATE INDEX "journal_entries_date_idx" ON "journal_entries" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX "journal_entries_type_idx" ON "journal_entries" USING btree ("entry_type");--> statement-breakpoint
CREATE INDEX "journal_entries_reference_idx" ON "journal_entries" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "journal_entries_status_idx" ON "journal_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "journal_entry_lines_entry_idx" ON "journal_entry_lines" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "journal_entry_lines_account_idx" ON "journal_entry_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "journal_entry_lines_party_idx" ON "journal_entry_lines" USING btree ("party_type","party_id");