-- Salesperson Commission Tracking
-- Migration: 0019_salesperson_commission

-- Add commission fields to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS salesperson_id UUID REFERENCES users(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5, 2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS commission_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS commission_paid_at TIMESTAMP;

-- Add commission fields to invoice_items for item-level tracking
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5, 2) DEFAULT 0;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(12, 2) DEFAULT 0;

-- Create commission rates table (configurable by category/metal type)
CREATE TABLE IF NOT EXISTS commission_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  category_id UUID REFERENCES inventory_categories(id),
  metal_type VARCHAR(20),
  min_sale_amount DECIMAL(12, 2) DEFAULT 0,
  max_sale_amount DECIMAL(12, 2),
  commission_percent DECIMAL(5, 2) NOT NULL,
  commission_type VARCHAR(20) DEFAULT 'percentage', -- percentage, fixed, tiered
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create commission ledger for tracking payouts
CREATE TABLE IF NOT EXISTS commission_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  salesperson_id UUID NOT NULL REFERENCES users(id),
  invoice_id UUID REFERENCES invoices(id),
  transaction_type VARCHAR(20) NOT NULL, -- earned, paid, adjustment
  amount DECIMAL(12, 2) NOT NULL,
  running_balance DECIMAL(12, 2) NOT NULL,
  description TEXT,
  payment_method VARCHAR(50),
  payment_reference VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Create salesperson summary view/table
CREATE TABLE IF NOT EXISTS salesperson_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  salesperson_id UUID NOT NULL REFERENCES users(id),
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  total_sales DECIMAL(12, 2) DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  total_commission_earned DECIMAL(12, 2) DEFAULT 0,
  total_commission_paid DECIMAL(12, 2) DEFAULT 0,
  pending_commission DECIMAL(12, 2) DEFAULT 0,
  avg_sale_amount DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(store_id, salesperson_id, period_month, period_year)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_salesperson ON invoices(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_invoices_commission_status ON invoices(commission_status);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_salesperson ON commission_ledger(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_store_date ON commission_ledger(store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_salesperson_summary_lookup ON salesperson_summary(store_id, salesperson_id, period_year, period_month);
