-- Store Access Requests Table
-- Allows store managers to request temporary access to other stores' inventory
CREATE TABLE IF NOT EXISTS "store_access_requests" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "requester_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "requester_store_id" UUID NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "requested_store_id" UUID NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "reason" TEXT NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'approved', 'rejected', 'expired')),
  "requested_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "valid_from" TIMESTAMP,
  "valid_until" TIMESTAMP,
  "approved_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "approved_at" TIMESTAMP,
  "rejection_reason" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS "idx_store_access_requests_requester" ON "store_access_requests"("requester_id");
CREATE INDEX IF NOT EXISTS "idx_store_access_requests_status" ON "store_access_requests"("status");
CREATE INDEX IF NOT EXISTS "idx_store_access_requests_requested_store" ON "store_access_requests"("requested_store_id");
CREATE INDEX IF NOT EXISTS "idx_store_access_requests_validity" ON "store_access_requests"("valid_from", "valid_until");

-- Comments
COMMENT ON TABLE "store_access_requests" IS 'Manages temporary access requests from store managers to view other stores inventory';
COMMENT ON COLUMN "store_access_requests"."requester_id" IS 'User requesting access';
COMMENT ON COLUMN "store_access_requests"."requester_store_id" IS 'The store where requester is assigned';
COMMENT ON COLUMN "store_access_requests"."requested_store_id" IS 'The store they want to access';
COMMENT ON COLUMN "store_access_requests"."reason" IS 'Business reason for access request';
COMMENT ON COLUMN "store_access_requests"."status" IS 'pending, approved, rejected, or expired';
COMMENT ON COLUMN "store_access_requests"."valid_from" IS 'When approved access starts';
COMMENT ON COLUMN "store_access_requests"."valid_until" IS 'When approved access expires';
COMMENT ON COLUMN "store_access_requests"."approved_by" IS 'Owner/General Manager who approved';

-- RESTORED TABLES FROM DELETED MIGRATION (0023_real_gamora)

-- Inventory Transfers
CREATE TABLE IF NOT EXISTS "inventory_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_number" varchar(100) NOT NULL,
	"source_store_id" uuid NOT NULL REFERENCES "stores"("id"),
	"destination_store_id" uuid NOT NULL REFERENCES "stores"("id"),
	"status" varchar(50) DEFAULT 'requested' NOT NULL,
	"notes" text,
	"created_by" uuid NOT NULL,
	"approved_by" uuid,
	"received_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_transfers_transfer_number_unique" UNIQUE("transfer_number")
);

CREATE TABLE IF NOT EXISTS "inventory_transfer_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_id" uuid NOT NULL REFERENCES "inventory_transfers"("id") ON DELETE CASCADE,
	"inventory_item_id" uuid NOT NULL REFERENCES "inventory_items"("id"),
	"quantity" integer DEFAULT 1 NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Sales Returns
CREATE TABLE IF NOT EXISTS "sales_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_number" varchar(100) NOT NULL,
	"invoice_id" uuid NOT NULL, -- references invoices(id) but explicit FK added later in original migration? No, adding here implicit or explicit
	"customer_id" uuid,
	"store_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'requested' NOT NULL,
	"total_refund_amount" numeric(12, 2) NOT NULL,
	"refund_method" varchar(50),
	"reason" text,
	"notes" text,
	"created_by" uuid NOT NULL,
	"approved_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sales_returns_return_number_unique" UNIQUE("return_number")
);

CREATE TABLE IF NOT EXISTS "sales_return_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_id" uuid NOT NULL, -- references sales_returns(id)
	"inventory_item_id" uuid NOT NULL,
	"invoice_item_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"refund_amount" numeric(12, 2) NOT NULL,
	"condition" varchar(50) DEFAULT 'good' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Category Performance
CREATE TABLE IF NOT EXISTS "category_performance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL REFERENCES "stores"("id"),
	"category_id" uuid REFERENCES "inventory_categories"("id"),
	"period_month" integer NOT NULL,
	"period_year" integer NOT NULL,
	"items_sold" integer DEFAULT 0,
	"total_revenue" numeric(14, 2) DEFAULT '0',
	"total_cost" numeric(14, 2) DEFAULT '0',
	"gross_profit" numeric(14, 2) DEFAULT '0',
	"gross_margin_percent" numeric(5, 2) DEFAULT '0',
	"total_weight_sold" numeric(12, 3) DEFAULT '0',
	"total_fine_gold_sold" numeric(12, 4) DEFAULT '0',
	"metal_profit_grams" numeric(10, 4) DEFAULT '0',
	"avg_holding_days" numeric(8, 2) DEFAULT '0',
	"inventory_turnover" numeric(8, 4) DEFAULT '0',
	"avg_roi" numeric(8, 4) DEFAULT '0',
	"best_roi" numeric(8, 4) DEFAULT '0',
	"worst_roi" numeric(8, 4) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "category_performance_store_id_category_id_period_month_period_year_unique" UNIQUE("store_id","category_id","period_month","period_year")
);

-- Commission Ledger
CREATE TABLE IF NOT EXISTS "commission_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL REFERENCES "stores"("id"),
	"salesperson_id" uuid NOT NULL REFERENCES "users"("id"),
	"invoice_id" uuid REFERENCES "invoices"("id"),
	"transaction_type" varchar(20) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"running_balance" numeric(12, 2) NOT NULL,
	"description" text,
	"payment_method" varchar(50),
	"payment_reference" varchar(100),
	"created_at" timestamp DEFAULT now(),
	"created_by" uuid REFERENCES "users"("id")
);

-- Commission Rates
CREATE TABLE IF NOT EXISTS "commission_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL REFERENCES "stores"("id"),
	"category_id" uuid REFERENCES "inventory_categories"("id"),
	"metal_type" varchar(20),
	"min_sale_amount" numeric(12, 2) DEFAULT '0',
	"max_sale_amount" numeric(12, 2),
	"commission_percent" numeric(5, 2) NOT NULL,
	"commission_type" varchar(20) DEFAULT 'percentage',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Inventory Valuations
CREATE TABLE IF NOT EXISTS "inventory_valuations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"valuation_date" timestamp NOT NULL,
	"total_items" integer,
	"total_weight" numeric(12, 3),
	"total_fine_gold" numeric(12, 4),
	"total_cost_value" numeric(14, 2),
	"total_market_value" numeric(14, 2),
	"total_unrealized_gain_loss" numeric(14, 2),
	"gold_rate_used" numeric(10, 2),
	"silver_rate_used" numeric(10, 2),
	"valuation_method" varchar(20) DEFAULT 'fifo',
	"category_breakdown" text,
	"aging_breakdown" text,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now()
);

-- Metal Profit Loss
CREATE TABLE IF NOT EXISTS "metal_profit_loss" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"period_date" timestamp NOT NULL,
	"period_type" varchar(20) NOT NULL,
	"gold_purchased_grams" numeric(12, 4) DEFAULT '0',
	"gold_sold_grams" numeric(12, 4) DEFAULT '0',
	"gold_in_manufacturing" numeric(12, 4) DEFAULT '0',
	"gold_wastage_grams" numeric(12, 4) DEFAULT '0',
	"gold_net_position" numeric(12, 4) DEFAULT '0',
	"fine_gold_purchased" numeric(12, 4) DEFAULT '0',
	"fine_gold_sold" numeric(12, 4) DEFAULT '0',
	"fine_gold_profit" numeric(12, 4) DEFAULT '0',
	"gold_purchase_value" numeric(14, 2) DEFAULT '0',
	"gold_sales_value" numeric(14, 2) DEFAULT '0',
	"currency_profit" numeric(14, 2) DEFAULT '0',
	"avg_purchase_rate" numeric(10, 2) DEFAULT '0',
	"avg_sale_rate" numeric(10, 2) DEFAULT '0',
	"rate_spread" numeric(10, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "metal_profit_loss_store_id_period_date_period_type_unique" UNIQUE("store_id","period_date","period_type")
);

-- Report Snapshots
CREATE TABLE IF NOT EXISTS "report_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"report_type" varchar(50) NOT NULL,
	"report_date" timestamp NOT NULL,
	"period_start" timestamp,
	"period_end" timestamp,
	"metrics" jsonb NOT NULL,
	"breakdown_by_category" jsonb,
	"breakdown_by_salesperson" jsonb,
	"breakdown_by_metal_type" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "report_snapshots_store_id_report_type_report_date_unique" UNIQUE("store_id","report_type","report_date")
);

-- Salesperson Summary
CREATE TABLE IF NOT EXISTS "salesperson_summary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"salesperson_id" uuid NOT NULL,
	"period_month" integer NOT NULL,
	"period_year" integer NOT NULL,
	"total_sales" numeric(12, 2) DEFAULT '0',
	"total_transactions" integer DEFAULT 0,
	"total_commission_earned" numeric(12, 2) DEFAULT '0',
	"total_commission_paid" numeric(12, 2) DEFAULT '0',
	"pending_commission" numeric(12, 2) DEFAULT '0',
	"avg_sale_amount" numeric(12, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "salesperson_summary_store_id_salesperson_id_period_month_period_year_unique" UNIQUE("store_id","salesperson_id","period_month","period_year")
);

-- Stock Aging Snapshots
CREATE TABLE IF NOT EXISTS "stock_aging_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"snapshot_date" timestamp NOT NULL,
	"items_0_30_days" integer DEFAULT 0,
	"items_31_60_days" integer DEFAULT 0,
	"items_61_90_days" integer DEFAULT 0,
	"items_91_180_days" integer DEFAULT 0,
	"items_181_365_days" integer DEFAULT 0,
	"items_over_365_days" integer DEFAULT 0,
	"value_0_30_days" numeric(14, 2) DEFAULT '0',
	"value_31_60_days" numeric(14, 2) DEFAULT '0',
	"value_61_90_days" numeric(14, 2) DEFAULT '0',
	"value_91_180_days" numeric(14, 2) DEFAULT '0',
	"value_181_365_days" numeric(14, 2) DEFAULT '0',
	"value_over_365_days" numeric(14, 2) DEFAULT '0',
	"total_items" integer,
	"total_value" numeric(14, 2),
	"avg_age_days" numeric(8, 2),
	"dead_stock_threshold_days" integer DEFAULT 180,
	"dead_stock_count" integer DEFAULT 0,
	"dead_stock_value" numeric(14, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now()
);
