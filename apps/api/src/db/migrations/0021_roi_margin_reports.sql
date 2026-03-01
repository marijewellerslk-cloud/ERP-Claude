-- Phase 5: ROI & Margin Analysis
-- Migration: 0021_roi_margin_reports

-- =====================================================
-- MARGIN FIELDS ON INVOICE ITEMS
-- =====================================================

-- Add ROI and margin analysis fields to invoice_items
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS metal_cost_at_sale DECIMAL(12, 2); -- MTM cost when sold
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS metal_margin_grams DECIMAL(10, 4); -- Profit in grams of gold
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS holding_period_days INTEGER; -- Days item was held before sale
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS effective_roi DECIMAL(8, 4); -- (Profit/Cost) * 100
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS gold_rate_at_sale DECIMAL(10, 2); -- Gold rate when sold
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS cost_of_capital DECIMAL(12, 2); -- Holding cost estimate

-- Add salesperson tracking to invoices (if not exists)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gross_profit DECIMAL(12, 2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gross_margin_percent DECIMAL(5, 2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS metal_profit_grams DECIMAL(10, 4);

-- =====================================================
-- REPORT SNAPSHOTS TABLE
-- =====================================================

-- Daily/Weekly/Monthly aggregated reports
CREATE TABLE IF NOT EXISTS report_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  report_type VARCHAR(50) NOT NULL, -- daily_sales, weekly_sales, monthly_sales, category_performance, salesperson_performance
  report_date DATE NOT NULL,
  period_start DATE,
  period_end DATE,

  -- Metrics (JSON for flexibility)
  metrics JSONB NOT NULL,

  -- Drill-down data
  breakdown_by_category JSONB,
  breakdown_by_salesperson JSONB,
  breakdown_by_metal_type JSONB,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(store_id, report_type, report_date)
);

-- =====================================================
-- CATEGORY PERFORMANCE TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS category_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  category_id UUID REFERENCES inventory_categories(id),
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,

  -- Sales metrics
  items_sold INTEGER DEFAULT 0,
  total_revenue DECIMAL(14, 2) DEFAULT 0,
  total_cost DECIMAL(14, 2) DEFAULT 0,
  gross_profit DECIMAL(14, 2) DEFAULT 0,
  gross_margin_percent DECIMAL(5, 2) DEFAULT 0,

  -- Weight metrics
  total_weight_sold DECIMAL(12, 3) DEFAULT 0,
  total_fine_gold_sold DECIMAL(12, 4) DEFAULT 0,
  metal_profit_grams DECIMAL(10, 4) DEFAULT 0,

  -- Inventory metrics
  avg_holding_days DECIMAL(8, 2) DEFAULT 0,
  inventory_turnover DECIMAL(8, 4) DEFAULT 0,

  -- ROI metrics
  avg_roi DECIMAL(8, 4) DEFAULT 0,
  best_roi DECIMAL(8, 4) DEFAULT 0,
  worst_roi DECIMAL(8, 4) DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(store_id, category_id, period_month, period_year)
);

-- =====================================================
-- METAL PROFIT/LOSS TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS metal_profit_loss (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  period_date DATE NOT NULL,
  period_type VARCHAR(20) NOT NULL, -- daily, weekly, monthly

  -- Gold metrics
  gold_purchased_grams DECIMAL(12, 4) DEFAULT 0,
  gold_sold_grams DECIMAL(12, 4) DEFAULT 0,
  gold_in_manufacturing DECIMAL(12, 4) DEFAULT 0,
  gold_wastage_grams DECIMAL(12, 4) DEFAULT 0,
  gold_net_position DECIMAL(12, 4) DEFAULT 0, -- Opening + Purchased - Sold - Wastage

  -- Fine gold equivalents
  fine_gold_purchased DECIMAL(12, 4) DEFAULT 0,
  fine_gold_sold DECIMAL(12, 4) DEFAULT 0,
  fine_gold_profit DECIMAL(12, 4) DEFAULT 0, -- Profit in pure gold terms

  -- Currency metrics
  gold_purchase_value DECIMAL(14, 2) DEFAULT 0,
  gold_sales_value DECIMAL(14, 2) DEFAULT 0,
  currency_profit DECIMAL(14, 2) DEFAULT 0,

  -- Rates
  avg_purchase_rate DECIMAL(10, 2) DEFAULT 0,
  avg_sale_rate DECIMAL(10, 2) DEFAULT 0,
  rate_spread DECIMAL(10, 2) DEFAULT 0, -- Sale rate - Purchase rate

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(store_id, period_date, period_type)
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_report_snapshots_store_type ON report_snapshots(store_id, report_type);
CREATE INDEX IF NOT EXISTS idx_report_snapshots_date ON report_snapshots(report_date);
CREATE INDEX IF NOT EXISTS idx_category_performance_lookup ON category_performance(store_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_metal_profit_loss_lookup ON metal_profit_loss(store_id, period_date, period_type);
CREATE INDEX IF NOT EXISTS idx_invoice_items_roi ON invoice_items(effective_roi);
CREATE INDEX IF NOT EXISTS idx_invoice_items_holding ON invoice_items(holding_period_days);
