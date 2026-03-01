-- Migration: Karigar & Metal Accounting Module
-- Description: Add fine gold equivalent fields, karigar management, job cards, and scrap tracking

-- ============================================================================
-- PHASE 1: FINE GOLD EQUIVALENT FIELDS
-- ============================================================================

-- Add fine gold fields to inventory_items
ALTER TABLE "inventory_items"
ADD COLUMN IF NOT EXISTS "fine_gold_equivalent" numeric(10, 4),
ADD COLUMN IF NOT EXISTS "last_valuation_date" timestamp,
ADD COLUMN IF NOT EXISTS "current_market_value" numeric(12, 2),
ADD COLUMN IF NOT EXISTS "unrealized_gain_loss" numeric(12, 2);

-- Add fine gold fields to supplier_account_transactions
ALTER TABLE "supplier_account_transactions"
ADD COLUMN IF NOT EXISTS "purity_percentage" numeric(5, 2),
ADD COLUMN IF NOT EXISTS "fine_gold_equivalent" numeric(10, 4);

-- ============================================================================
-- PHASE 2: KARIGAR (ARTISAN) MANAGEMENT
-- ============================================================================

-- Create karigars table
CREATE TABLE IF NOT EXISTS "karigars" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id" uuid NOT NULL REFERENCES "stores"("id"),
  "karigar_code" varchar(20) UNIQUE,
  "name" varchar(100) NOT NULL,
  "phone" varchar(20),
  "address" text,
  "specialization" varchar(100),
  "skill_level" varchar(20) DEFAULT 'standard',
  "base_labour_rate" numeric(10, 2),
  "rate_type" varchar(20) DEFAULT 'per_gram',
  "gold_balance" numeric(10, 3) DEFAULT '0' NOT NULL,
  "fine_gold_balance" numeric(10, 4) DEFAULT '0' NOT NULL,
  "pending_labour" numeric(12, 2) DEFAULT '0' NOT NULL,
  "advance_balance" numeric(12, 2) DEFAULT '0' NOT NULL,
  "wastage_allowance" numeric(5, 2) DEFAULT '2.00' NOT NULL,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "joining_date" timestamp,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create karigars indexes
CREATE INDEX IF NOT EXISTS "karigars_store_idx" ON "karigars" ("store_id");
CREATE INDEX IF NOT EXISTS "karigars_status_idx" ON "karigars" ("status");
CREATE INDEX IF NOT EXISTS "karigars_code_idx" ON "karigars" ("karigar_code");

-- Create job_cards table
CREATE TABLE IF NOT EXISTS "job_cards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "job_number" varchar(30) UNIQUE NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "stores"("id"),
  "karigar_id" uuid NOT NULL REFERENCES "karigars"("id"),
  "custom_order_id" uuid REFERENCES "custom_orders"("id"),
  "job_type" varchar(50) NOT NULL,
  "item_description" text,
  "category" varchar(50),
  "metal_issued" numeric(10, 3) NOT NULL,
  "metal_purity" numeric(5, 2) NOT NULL,
  "fine_gold_issued" numeric(10, 4) NOT NULL,
  "metal_type" varchar(20) DEFAULT 'gold' NOT NULL,
  "issue_date" timestamp NOT NULL,
  "issued_by" uuid NOT NULL REFERENCES "users"("id"),
  "stones_issued" jsonb,
  "other_materials_issued" jsonb,
  "finished_weight" numeric(10, 3),
  "scrap_returned" numeric(10, 3) DEFAULT '0',
  "actual_wastage" numeric(10, 3),
  "wastage_percentage" numeric(5, 2),
  "return_date" timestamp,
  "received_by" uuid REFERENCES "users"("id"),
  "allowed_wastage" numeric(10, 3),
  "excess_wastage" numeric(10, 3),
  "wastage_deduction_value" numeric(12, 2),
  "labour_charge" numeric(10, 2),
  "labour_paid" numeric(10, 2) DEFAULT '0',
  "quality_rating" integer,
  "expected_completion_date" timestamp,
  "actual_completion_date" timestamp,
  "resulting_inventory_item_id" uuid REFERENCES "inventory_items"("id"),
  "status" varchar(20) DEFAULT 'issued' NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create job_cards indexes
CREATE INDEX IF NOT EXISTS "job_cards_store_idx" ON "job_cards" ("store_id");
CREATE INDEX IF NOT EXISTS "job_cards_karigar_idx" ON "job_cards" ("karigar_id");
CREATE INDEX IF NOT EXISTS "job_cards_status_idx" ON "job_cards" ("status");
CREATE INDEX IF NOT EXISTS "job_cards_job_number_idx" ON "job_cards" ("job_number");
CREATE INDEX IF NOT EXISTS "job_cards_issue_date_idx" ON "job_cards" ("issue_date");

-- Create karigar_transactions table
CREATE TABLE IF NOT EXISTS "karigar_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "karigar_id" uuid NOT NULL REFERENCES "karigars"("id") ON DELETE CASCADE,
  "store_id" uuid NOT NULL REFERENCES "stores"("id"),
  "job_card_id" uuid REFERENCES "job_cards"("id"),
  "transaction_type" varchar(30) NOT NULL,
  "gold_amount" numeric(10, 3) DEFAULT '0' NOT NULL,
  "fine_gold_amount" numeric(10, 4) DEFAULT '0' NOT NULL,
  "gold_purity" numeric(5, 2),
  "cash_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
  "running_gold_balance" numeric(10, 3) NOT NULL,
  "running_fine_gold_balance" numeric(10, 4) NOT NULL,
  "running_cash_balance" numeric(12, 2) NOT NULL,
  "payment_method" varchar(50),
  "payment_reference" varchar(255),
  "description" text NOT NULL,
  "transaction_date" timestamp NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create karigar_transactions indexes
CREATE INDEX IF NOT EXISTS "karigar_transactions_karigar_idx" ON "karigar_transactions" ("karigar_id");
CREATE INDEX IF NOT EXISTS "karigar_transactions_store_idx" ON "karigar_transactions" ("store_id");
CREATE INDEX IF NOT EXISTS "karigar_transactions_job_card_idx" ON "karigar_transactions" ("job_card_id");
CREATE INDEX IF NOT EXISTS "karigar_transactions_date_idx" ON "karigar_transactions" ("transaction_date");
CREATE INDEX IF NOT EXISTS "karigar_transactions_type_idx" ON "karigar_transactions" ("transaction_type");

-- ============================================================================
-- PHASE 3: SCRAP & WASTAGE MANAGEMENT
-- ============================================================================

-- Create scrap_inventory table
CREATE TABLE IF NOT EXISTS "scrap_inventory" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id" uuid NOT NULL REFERENCES "stores"("id"),
  "scrap_code" varchar(30) UNIQUE,
  "scrap_type" varchar(50) NOT NULL,
  "metal_type" varchar(20) DEFAULT 'gold' NOT NULL,
  "gross_weight" numeric(10, 3) NOT NULL,
  "estimated_purity" numeric(5, 2),
  "estimated_fine_weight" numeric(10, 4),
  "source_job_card_id" uuid REFERENCES "job_cards"("id"),
  "source_karigar_id" uuid REFERENCES "karigars"("id"),
  "source_description" text,
  "estimated_value" numeric(12, 2),
  "gold_rate_at_collection" numeric(12, 2),
  "status" varchar(20) DEFAULT 'accumulated' NOT NULL,
  "collected_at" timestamp DEFAULT now() NOT NULL,
  "collected_by" uuid REFERENCES "users"("id"),
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create scrap_inventory indexes
CREATE INDEX IF NOT EXISTS "scrap_inventory_store_idx" ON "scrap_inventory" ("store_id");
CREATE INDEX IF NOT EXISTS "scrap_inventory_status_idx" ON "scrap_inventory" ("status");
CREATE INDEX IF NOT EXISTS "scrap_inventory_type_idx" ON "scrap_inventory" ("scrap_type");

-- Create melting_records table
CREATE TABLE IF NOT EXISTS "melting_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id" uuid NOT NULL REFERENCES "stores"("id"),
  "melting_number" varchar(30) UNIQUE NOT NULL,
  "melting_date" timestamp NOT NULL,
  "input_weight" numeric(10, 3) NOT NULL,
  "input_purity" numeric(5, 2),
  "input_fine_gold" numeric(10, 4),
  "scrap_items" jsonb,
  "output_weight" numeric(10, 3),
  "output_purity" numeric(5, 2),
  "output_fine_gold" numeric(10, 4),
  "recovery_percentage" numeric(5, 2),
  "melting_loss" numeric(10, 4),
  "melting_loss_percentage" numeric(5, 2),
  "refining_cost" numeric(10, 2),
  "refiner_name" varchar(100),
  "refiner_invoice" varchar(100),
  "output_disposition" varchar(30),
  "resulting_inventory_item_id" uuid REFERENCES "inventory_items"("id"),
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "completed_at" timestamp,
  "notes" text,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create melting_records indexes
CREATE INDEX IF NOT EXISTS "melting_records_store_idx" ON "melting_records" ("store_id");
CREATE INDEX IF NOT EXISTS "melting_records_status_idx" ON "melting_records" ("status");
CREATE INDEX IF NOT EXISTS "melting_records_date_idx" ON "melting_records" ("melting_date");

-- Create wastage_allowances table
CREATE TABLE IF NOT EXISTS "wastage_allowances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id" uuid REFERENCES "stores"("id"),
  "category_id" uuid REFERENCES "inventory_categories"("id"),
  "item_type" varchar(50),
  "job_type" varchar(50),
  "allowed_percentage" numeric(5, 2) NOT NULL,
  "min_weight" numeric(10, 3),
  "max_weight" numeric(10, 3),
  "effective_from" timestamp DEFAULT now() NOT NULL,
  "effective_to" timestamp,
  "is_active" boolean DEFAULT true NOT NULL,
  "notes" text,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create wastage_allowances indexes
CREATE INDEX IF NOT EXISTS "wastage_allowances_store_idx" ON "wastage_allowances" ("store_id");
CREATE INDEX IF NOT EXISTS "wastage_allowances_category_idx" ON "wastage_allowances" ("category_id");
CREATE INDEX IF NOT EXISTS "wastage_allowances_item_type_idx" ON "wastage_allowances" ("item_type");
CREATE INDEX IF NOT EXISTS "wastage_allowances_active_idx" ON "wastage_allowances" ("is_active");
