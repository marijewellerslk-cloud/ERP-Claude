-- Phase 2, 3, 4: Karigar Management, Scrap/Wastage, Stock Valuation
-- Migration: 0020_karigar_scrap_valuation

-- =====================================================
-- PHASE 2: KARIGAR (ARTISAN) MANAGEMENT
-- =====================================================

-- Karigars (Artisans) table
CREATE TABLE IF NOT EXISTS karigars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  specialization VARCHAR(100), -- rings, chains, bangles, necklaces
  base_labour_rate DECIMAL(10, 2) DEFAULT 0,
  gold_balance DECIMAL(10, 3) DEFAULT 0, -- grams of gold held
  silver_balance DECIMAL(10, 3) DEFAULT 0, -- grams of silver held
  pending_labour DECIMAL(12, 2) DEFAULT 0, -- labour amount owed
  wastage_allowance DECIMAL(5, 2) DEFAULT 2.00, -- default wastage % allowed
  status VARCHAR(20) DEFAULT 'active', -- active, inactive, blacklisted
  rating DECIMAL(3, 2) DEFAULT 0, -- 0-5 rating
  total_jobs_completed INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Job Cards table (metal issue/return tracking)
CREATE TABLE IF NOT EXISTS job_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number VARCHAR(20) UNIQUE NOT NULL,
  store_id UUID NOT NULL REFERENCES stores(id),
  karigar_id UUID NOT NULL REFERENCES karigars(id),
  custom_order_id UUID REFERENCES custom_orders(id),

  -- Job Details
  job_type VARCHAR(50) NOT NULL, -- new_making, repair, alteration, polish
  item_description TEXT,
  design_reference VARCHAR(100),
  expected_completion_date TIMESTAMP,
  priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent

  -- Metal Issue
  metal_type VARCHAR(20) DEFAULT 'gold',
  metal_purity VARCHAR(10),
  metal_issued DECIMAL(10, 3) NOT NULL, -- grams issued
  fine_gold_issued DECIMAL(10, 4), -- fine gold equivalent
  issue_date TIMESTAMP DEFAULT NOW(),
  issued_by UUID REFERENCES users(id),
  issue_notes TEXT,

  -- Metal Return
  finished_weight DECIMAL(10, 3), -- weight of finished piece
  scrap_returned DECIMAL(10, 3) DEFAULT 0, -- scrap/filings returned
  actual_wastage DECIMAL(10, 3), -- calculated wastage
  wastage_percentage DECIMAL(5, 2), -- actual wastage %
  return_date TIMESTAMP,
  received_by UUID REFERENCES users(id),
  return_notes TEXT,

  -- Stone Details
  stones_issued TEXT, -- JSON array of stones given
  stones_returned TEXT, -- JSON array of stones returned
  stones_used TEXT, -- JSON array of stones set in piece

  -- Labour
  labour_type VARCHAR(20) DEFAULT 'per_gram', -- per_gram, per_piece, hourly
  labour_rate DECIMAL(10, 2),
  labour_charge DECIMAL(10, 2) DEFAULT 0,
  labour_paid DECIMAL(10, 2) DEFAULT 0,

  -- Quality
  quality_check_status VARCHAR(20), -- pending, passed, failed, rework
  quality_notes TEXT,
  quality_checked_by UUID REFERENCES users(id),
  quality_check_date TIMESTAMP,

  -- Status
  status VARCHAR(20) DEFAULT 'issued', -- draft, issued, in_progress, returned, quality_check, completed, cancelled

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Karigar Transactions ledger
CREATE TABLE IF NOT EXISTS karigar_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  karigar_id UUID NOT NULL REFERENCES karigars(id),
  store_id UUID NOT NULL REFERENCES stores(id),
  job_card_id UUID REFERENCES job_cards(id),

  transaction_type VARCHAR(30) NOT NULL, -- metal_issue, metal_return, labour_credit, wastage_debit, payment, advance, adjustment

  -- Metal Movement
  gold_amount DECIMAL(10, 3), -- positive = given to karigar, negative = returned
  silver_amount DECIMAL(10, 3),
  fine_gold_equivalent DECIMAL(10, 4),

  -- Cash Movement
  cash_amount DECIMAL(12, 2), -- positive = owed to karigar, negative = paid

  -- Running Balances
  running_gold_balance DECIMAL(10, 3),
  running_silver_balance DECIMAL(10, 3),
  running_cash_balance DECIMAL(12, 2),

  -- Reference
  reference_number VARCHAR(50),
  payment_method VARCHAR(50), -- cash, bank_transfer, upi, cheque
  payment_reference VARCHAR(100),

  description TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- PHASE 3: WASTAGE & SCRAP MANAGEMENT
-- =====================================================

-- Scrap Inventory table
CREATE TABLE IF NOT EXISTS scrap_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  scrap_type VARCHAR(50) NOT NULL, -- dust, filings, rejected, polishing_waste, old_exchange, melted_scrap
  metal_type VARCHAR(20) DEFAULT 'gold',
  estimated_purity VARCHAR(10),
  fine_gold_equivalent DECIMAL(10, 4),
  weight DECIMAL(10, 3) NOT NULL, -- current weight in grams

  -- Source tracking
  source_type VARCHAR(30), -- job_card, customer_exchange, internal
  source_job_card_id UUID REFERENCES job_cards(id),
  source_invoice_id UUID REFERENCES invoices(id),

  -- Valuation
  estimated_value DECIMAL(12, 2),
  valuation_date TIMESTAMP,

  -- Status
  status VARCHAR(20) DEFAULT 'accumulated', -- accumulated, sent_for_melting, refined, sold

  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Melting Records table
CREATE TABLE IF NOT EXISTS melting_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  melting_number VARCHAR(20) UNIQUE NOT NULL,
  melting_date TIMESTAMP NOT NULL,

  -- Input (what went in)
  input_weight DECIMAL(10, 3) NOT NULL,
  input_purity VARCHAR(10),
  input_fine_gold DECIMAL(10, 4),
  input_source TEXT, -- JSON array of scrap_inventory IDs used

  -- Output (what came out)
  output_weight DECIMAL(10, 3),
  output_purity VARCHAR(10),
  output_fine_gold DECIMAL(10, 4),

  -- Recovery metrics
  recovery_percentage DECIMAL(5, 2), -- (output_fine_gold / input_fine_gold) * 100
  loss_weight DECIMAL(10, 3), -- input - output
  loss_percentage DECIMAL(5, 2),

  -- Refiner details
  refiner_type VARCHAR(20) DEFAULT 'internal', -- internal, external
  refiner_name VARCHAR(100),
  refiner_reference VARCHAR(100),
  refining_cost DECIMAL(10, 2) DEFAULT 0,

  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed, cancelled

  notes TEXT,
  created_by UUID REFERENCES users(id),
  completed_by UUID REFERENCES users(id),
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Wastage Allowances configuration
CREATE TABLE IF NOT EXISTS wastage_allowances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  category_id UUID REFERENCES inventory_categories(id),
  item_type VARCHAR(50), -- ring, chain, bangle, necklace, pendant, earring
  metal_type VARCHAR(20) DEFAULT 'gold',

  -- Allowance configuration
  allowed_percentage DECIMAL(5, 2) NOT NULL, -- max allowed wastage %
  warning_percentage DECIMAL(5, 2), -- threshold for warnings

  -- Applicability
  min_weight DECIMAL(10, 3), -- apply only for items above this weight
  max_weight DECIMAL(10, 3), -- apply only for items below this weight

  -- Validity
  effective_from TIMESTAMP DEFAULT NOW(),
  effective_to TIMESTAMP,
  is_active BOOLEAN DEFAULT true,

  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- PHASE 4: STOCK AGING & DYNAMIC VALUATION
-- =====================================================

-- Add valuation fields to inventory_items
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS last_valuation_date TIMESTAMP;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS current_market_value DECIMAL(12, 2);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS unrealized_gain_loss DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS gold_rate_at_purchase DECIMAL(10, 2);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS valuation_method VARCHAR(20) DEFAULT 'fifo'; -- fifo, lifo, weighted_avg

-- Inventory Valuation History (for audit trail)
CREATE TABLE IF NOT EXISTS inventory_valuations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  valuation_date DATE NOT NULL,

  -- Summary
  total_items INTEGER,
  total_weight DECIMAL(12, 3),
  total_fine_gold DECIMAL(12, 4),

  -- Values
  total_cost_value DECIMAL(14, 2), -- sum of calculatedCost
  total_market_value DECIMAL(14, 2), -- sum of currentMarketValue
  total_unrealized_gain_loss DECIMAL(14, 2),

  -- Gold rate used
  gold_rate_used DECIMAL(10, 2),
  silver_rate_used DECIMAL(10, 2),

  -- Valuation method
  valuation_method VARCHAR(20) DEFAULT 'fifo',

  -- Breakdown by category (JSON)
  category_breakdown TEXT,

  -- Breakdown by aging (JSON)
  aging_breakdown TEXT,

  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Stock Aging Snapshots
CREATE TABLE IF NOT EXISTS stock_aging_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  snapshot_date DATE NOT NULL,

  -- Aging buckets (item count)
  items_0_30_days INTEGER DEFAULT 0,
  items_31_60_days INTEGER DEFAULT 0,
  items_61_90_days INTEGER DEFAULT 0,
  items_91_180_days INTEGER DEFAULT 0,
  items_181_365_days INTEGER DEFAULT 0,
  items_over_365_days INTEGER DEFAULT 0,

  -- Aging buckets (value)
  value_0_30_days DECIMAL(14, 2) DEFAULT 0,
  value_31_60_days DECIMAL(14, 2) DEFAULT 0,
  value_61_90_days DECIMAL(14, 2) DEFAULT 0,
  value_91_180_days DECIMAL(14, 2) DEFAULT 0,
  value_181_365_days DECIMAL(14, 2) DEFAULT 0,
  value_over_365_days DECIMAL(14, 2) DEFAULT 0,

  -- Totals
  total_items INTEGER,
  total_value DECIMAL(14, 2),
  avg_age_days DECIMAL(8, 2),

  -- Dead stock threshold used
  dead_stock_threshold_days INTEGER DEFAULT 180,
  dead_stock_count INTEGER DEFAULT 0,
  dead_stock_value DECIMAL(14, 2) DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Karigar indexes
CREATE INDEX IF NOT EXISTS idx_karigars_store ON karigars(store_id);
CREATE INDEX IF NOT EXISTS idx_karigars_status ON karigars(status);
CREATE INDEX IF NOT EXISTS idx_karigars_specialization ON karigars(specialization);

-- Job Cards indexes
CREATE INDEX IF NOT EXISTS idx_job_cards_store ON job_cards(store_id);
CREATE INDEX IF NOT EXISTS idx_job_cards_karigar ON job_cards(karigar_id);
CREATE INDEX IF NOT EXISTS idx_job_cards_status ON job_cards(status);
CREATE INDEX IF NOT EXISTS idx_job_cards_dates ON job_cards(issue_date, return_date);

-- Karigar Transactions indexes
CREATE INDEX IF NOT EXISTS idx_karigar_transactions_karigar ON karigar_transactions(karigar_id);
CREATE INDEX IF NOT EXISTS idx_karigar_transactions_job ON karigar_transactions(job_card_id);
CREATE INDEX IF NOT EXISTS idx_karigar_transactions_date ON karigar_transactions(created_at);

-- Scrap indexes
CREATE INDEX IF NOT EXISTS idx_scrap_inventory_store ON scrap_inventory(store_id);
CREATE INDEX IF NOT EXISTS idx_scrap_inventory_status ON scrap_inventory(status);
CREATE INDEX IF NOT EXISTS idx_scrap_inventory_type ON scrap_inventory(scrap_type);

-- Melting indexes
CREATE INDEX IF NOT EXISTS idx_melting_records_store ON melting_records(store_id);
CREATE INDEX IF NOT EXISTS idx_melting_records_date ON melting_records(melting_date);
CREATE INDEX IF NOT EXISTS idx_melting_records_status ON melting_records(status);

-- Valuation indexes
CREATE INDEX IF NOT EXISTS idx_inventory_valuations_store_date ON inventory_valuations(store_id, valuation_date);
CREATE INDEX IF NOT EXISTS idx_stock_aging_store_date ON stock_aging_snapshots(store_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_inventory_items_valuation ON inventory_items(last_valuation_date);
