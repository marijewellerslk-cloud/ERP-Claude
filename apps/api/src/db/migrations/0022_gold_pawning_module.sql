-- Gold Pawning Module Migration
-- Adds LTV management, KYC, documents, renewals, auctions, margin calls, notifications

-- ============================================================================
-- ALTER EXISTING TABLES
-- ============================================================================

-- Add enhanced fields to gold_loans
ALTER TABLE "gold_loans" ADD COLUMN IF NOT EXISTS "loan_type" varchar(20) DEFAULT 'bullet';
ALTER TABLE "gold_loans" ADD COLUMN IF NOT EXISTS "interest_rate_config_id" uuid;
ALTER TABLE "gold_loans" ADD COLUMN IF NOT EXISTS "disbursement_date" timestamp;
ALTER TABLE "gold_loans" ADD COLUMN IF NOT EXISTS "disbursement_method" varchar(50);
ALTER TABLE "gold_loans" ADD COLUMN IF NOT EXISTS "disbursement_reference" varchar(255);
ALTER TABLE "gold_loans" ADD COLUMN IF NOT EXISTS "original_ltv" decimal(5,2);
ALTER TABLE "gold_loans" ADD COLUMN IF NOT EXISTS "current_ltv" decimal(5,2);
ALTER TABLE "gold_loans" ADD COLUMN IF NOT EXISTS "ltv_status" varchar(20) DEFAULT 'safe';
ALTER TABLE "gold_loans" ADD COLUMN IF NOT EXISTS "total_gold_value" decimal(12,2);
ALTER TABLE "gold_loans" ADD COLUMN IF NOT EXISTS "kyc_verified" boolean DEFAULT false;
ALTER TABLE "gold_loans" ADD COLUMN IF NOT EXISTS "borrower_present_at_valuation" boolean DEFAULT false;
ALTER TABLE "gold_loans" ADD COLUMN IF NOT EXISTS "accrued_interest" decimal(12,2) DEFAULT '0';
ALTER TABLE "gold_loans" ADD COLUMN IF NOT EXISTS "last_interest_calc_date" timestamp;
ALTER TABLE "gold_loans" ADD COLUMN IF NOT EXISTS "total_interest_paid" decimal(12,2) DEFAULT '0';
ALTER TABLE "gold_loans" ADD COLUMN IF NOT EXISTS "total_penalty_paid" decimal(12,2) DEFAULT '0';
ALTER TABLE "gold_loans" ADD COLUMN IF NOT EXISTS "outstanding_balance" decimal(12,2);
ALTER TABLE "gold_loans" ADD COLUMN IF NOT EXISTS "renewal_count" integer DEFAULT 0;
ALTER TABLE "gold_loans" ADD COLUMN IF NOT EXISTS "parent_loan_id" uuid;
ALTER TABLE "gold_loans" ADD COLUMN IF NOT EXISTS "internal_notes" text;

-- Add indexes for gold_loans
CREATE INDEX IF NOT EXISTS "gold_loans_ltv_status_idx" ON "gold_loans" ("ltv_status");
CREATE INDEX IF NOT EXISTS "gold_loans_maturity_idx" ON "gold_loans" ("maturity_date");

-- Add enhanced fields to pledged_gold
ALTER TABLE "pledged_gold" ADD COLUMN IF NOT EXISTS "item_type" varchar(50);
ALTER TABLE "pledged_gold" ADD COLUMN IF NOT EXISTS "quantity" integer DEFAULT 1 NOT NULL;
ALTER TABLE "pledged_gold" ADD COLUMN IF NOT EXISTS "stone_weight" decimal(10,3) DEFAULT '0';
ALTER TABLE "pledged_gold" ADD COLUMN IF NOT EXISTS "purity_percentage" decimal(5,2);
ALTER TABLE "pledged_gold" ADD COLUMN IF NOT EXISTS "fine_gold_equivalent" decimal(10,4);
ALTER TABLE "pledged_gold" ADD COLUMN IF NOT EXISTS "gold_rate_at_pledge" decimal(10,2);
ALTER TABLE "pledged_gold" ADD COLUMN IF NOT EXISTS "current_market_value" decimal(12,2);
ALTER TABLE "pledged_gold" ADD COLUMN IF NOT EXISTS "is_hallmarked" boolean DEFAULT false;
ALTER TABLE "pledged_gold" ADD COLUMN IF NOT EXISTS "hallmark_number" varchar(50);
ALTER TABLE "pledged_gold" ADD COLUMN IF NOT EXISTS "huid_number" varchar(50);
ALTER TABLE "pledged_gold" ADD COLUMN IF NOT EXISTS "storage_location" varchar(100);
ALTER TABLE "pledged_gold" ADD COLUMN IF NOT EXISTS "seal_number" varchar(50);
ALTER TABLE "pledged_gold" ADD COLUMN IF NOT EXISTS "is_released" boolean DEFAULT false;
ALTER TABLE "pledged_gold" ADD COLUMN IF NOT EXISTS "released_at" timestamp;
ALTER TABLE "pledged_gold" ADD COLUMN IF NOT EXISTS "released_to" varchar(255);
ALTER TABLE "pledged_gold" ADD COLUMN IF NOT EXISTS "appraisal_notes" text;

CREATE INDEX IF NOT EXISTS "pledged_gold_loan_idx" ON "pledged_gold" ("loan_id");

-- ============================================================================
-- NEW TABLES
-- ============================================================================

-- Interest Rate Configuration
CREATE TABLE IF NOT EXISTS "loan_interest_rates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "stores"("id"),
  "rate_name" varchar(100) NOT NULL,
  "min_amount" decimal(12,2) NOT NULL,
  "max_amount" decimal(12,2),
  "annual_rate" decimal(5,2) NOT NULL,
  "monthly_rate" decimal(5,4),
  "daily_rate" decimal(8,6),
  "penalty_rate" decimal(5,2) DEFAULT '2.00',
  "max_ltv" decimal(5,2) NOT NULL,
  "max_tenure_months" integer DEFAULT 12,
  "effective_from" timestamp NOT NULL,
  "effective_to" timestamp,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "loan_interest_rates_store_idx" ON "loan_interest_rates" ("store_id");
CREATE INDEX IF NOT EXISTS "loan_interest_rates_active_idx" ON "loan_interest_rates" ("store_id", "is_active");

-- LTV Tracking History
CREATE TABLE IF NOT EXISTS "loan_ltv_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "loan_id" uuid NOT NULL REFERENCES "gold_loans"("id") ON DELETE CASCADE,
  "calculation_date" timestamp DEFAULT now() NOT NULL,
  "gold_rate_used" decimal(10,2) NOT NULL,
  "total_gold_value" decimal(12,2) NOT NULL,
  "outstanding_amount" decimal(12,2) NOT NULL,
  "current_ltv" decimal(5,2) NOT NULL,
  "max_allowed_ltv" decimal(5,2) NOT NULL,
  "ltv_status" varchar(20) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "loan_ltv_history_loan_idx" ON "loan_ltv_history" ("loan_id");
CREATE INDEX IF NOT EXISTS "loan_ltv_history_date_idx" ON "loan_ltv_history" ("calculation_date");

-- Customer KYC
CREATE TABLE IF NOT EXISTS "customer_kyc" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "store_id" uuid NOT NULL REFERENCES "stores"("id"),
  "aadhaar_number" varchar(12),
  "aadhaar_verified" boolean DEFAULT false,
  "aadhaar_verified_at" timestamp,
  "pan_number" varchar(10),
  "pan_verified" boolean DEFAULT false,
  "pan_verified_at" timestamp,
  "voter_id" varchar(20),
  "passport_number" varchar(20),
  "driving_license" varchar(20),
  "aadhaar_front_url" text,
  "aadhaar_back_url" text,
  "pan_url" text,
  "photo_url" text,
  "signature_url" text,
  "address_proof_url" text,
  "address_proof_type" varchar(50),
  "kyc_status" varchar(20) DEFAULT 'pending' NOT NULL,
  "verification_level" varchar(20) DEFAULT 'basic',
  "last_verified_at" timestamp,
  "verified_by" uuid REFERENCES "users"("id"),
  "rejection_reason" text,
  "expires_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE("customer_id")
);

CREATE INDEX IF NOT EXISTS "customer_kyc_store_idx" ON "customer_kyc" ("store_id");
CREATE INDEX IF NOT EXISTS "customer_kyc_status_idx" ON "customer_kyc" ("kyc_status");

-- Loan Documents
CREATE TABLE IF NOT EXISTS "loan_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "loan_id" uuid NOT NULL REFERENCES "gold_loans"("id") ON DELETE CASCADE,
  "document_type" varchar(50) NOT NULL,
  "document_number" varchar(100) NOT NULL,
  "generated_at" timestamp DEFAULT now() NOT NULL,
  "document_url" text,
  "document_data" jsonb,
  "generated_by" uuid REFERENCES "users"("id"),
  "printed_count" integer DEFAULT 0,
  "last_printed_at" timestamp,
  "email_sent_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE("document_number")
);

CREATE INDEX IF NOT EXISTS "loan_documents_loan_idx" ON "loan_documents" ("loan_id");
CREATE INDEX IF NOT EXISTS "loan_documents_type_idx" ON "loan_documents" ("document_type");

-- Loan Renewals
CREATE TABLE IF NOT EXISTS "loan_renewals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "original_loan_id" uuid NOT NULL REFERENCES "gold_loans"("id"),
  "new_loan_id" uuid REFERENCES "gold_loans"("id"),
  "renewal_date" timestamp DEFAULT now() NOT NULL,
  "outstanding_at_renewal" decimal(12,2) NOT NULL,
  "interest_paid_at_renewal" decimal(12,2) NOT NULL,
  "new_loan_amount" decimal(12,2) NOT NULL,
  "new_interest_rate" decimal(5,2) NOT NULL,
  "new_tenure_months" integer NOT NULL,
  "gold_revaluation_done" boolean DEFAULT false,
  "new_gold_value" decimal(12,2),
  "new_ltv" decimal(5,2),
  "renewal_reason" text,
  "processed_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "loan_renewals_original_idx" ON "loan_renewals" ("original_loan_id");
CREATE INDEX IF NOT EXISTS "loan_renewals_new_idx" ON "loan_renewals" ("new_loan_id");

-- Margin Calls
CREATE TABLE IF NOT EXISTS "margin_calls" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "loan_id" uuid NOT NULL REFERENCES "gold_loans"("id") ON DELETE CASCADE,
  "store_id" uuid NOT NULL REFERENCES "stores"("id"),
  "call_date" timestamp DEFAULT now() NOT NULL,
  "trigger_reason" varchar(50) NOT NULL,
  "gold_rate_at_call" decimal(10,2) NOT NULL,
  "ltv_at_call" decimal(5,2) NOT NULL,
  "required_payment" decimal(12,2) NOT NULL,
  "deadline" timestamp NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "payment_received" decimal(12,2) DEFAULT '0',
  "compliance_date" timestamp,
  "escalated_to_auction" boolean DEFAULT false,
  "notification_sent" boolean DEFAULT false,
  "notification_sent_at" timestamp,
  "notes" text,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "margin_calls_loan_idx" ON "margin_calls" ("loan_id");
CREATE INDEX IF NOT EXISTS "margin_calls_store_idx" ON "margin_calls" ("store_id");
CREATE INDEX IF NOT EXISTS "margin_calls_status_idx" ON "margin_calls" ("status");
CREATE INDEX IF NOT EXISTS "margin_calls_deadline_idx" ON "margin_calls" ("deadline");

-- Loan Auctions
CREATE TABLE IF NOT EXISTS "loan_auctions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "loan_id" uuid NOT NULL REFERENCES "gold_loans"("id"),
  "store_id" uuid NOT NULL REFERENCES "stores"("id"),
  "auction_status" varchar(20) DEFAULT 'initiated' NOT NULL,
  "initiation_date" timestamp DEFAULT now() NOT NULL,
  "notice_sent_date" timestamp,
  "notice_type" varchar(50),
  "release_deadline" timestamp,
  "daily_penalty_rate" decimal(8,2) DEFAULT '5000',
  "total_penalty_accrued" decimal(12,2) DEFAULT '0',
  "scheduled_date" timestamp,
  "auction_location" text,
  "reserve_price" decimal(12,2),
  "final_sale_price" decimal(12,2),
  "buyer_name" varchar(255),
  "buyer_contact" varchar(20),
  "buyer_id_number" varchar(50),
  "amount_recovered" decimal(12,2),
  "surplus_amount" decimal(12,2),
  "deficit_amount" decimal(12,2),
  "settlement_date" timestamp,
  "settled_by" uuid REFERENCES "users"("id"),
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "loan_auctions_loan_idx" ON "loan_auctions" ("loan_id");
CREATE INDEX IF NOT EXISTS "loan_auctions_store_idx" ON "loan_auctions" ("store_id");
CREATE INDEX IF NOT EXISTS "loan_auctions_status_idx" ON "loan_auctions" ("auction_status");
CREATE INDEX IF NOT EXISTS "loan_auctions_deadline_idx" ON "loan_auctions" ("release_deadline");

-- Notification Templates
CREATE TABLE IF NOT EXISTS "notification_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid REFERENCES "stores"("id"),
  "template_code" varchar(50) NOT NULL,
  "template_name" varchar(100) NOT NULL,
  "channel" varchar(20) NOT NULL,
  "subject" text,
  "body_template" text NOT NULL,
  "variables" jsonb,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE("template_code", "channel", "store_id")
);

-- Loan Notifications Log
CREATE TABLE IF NOT EXISTS "loan_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "loan_id" uuid NOT NULL REFERENCES "gold_loans"("id") ON DELETE CASCADE,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id"),
  "notification_type" varchar(50) NOT NULL,
  "channel" varchar(20) NOT NULL,
  "template_id" uuid REFERENCES "notification_templates"("id"),
  "recipient_phone" varchar(20),
  "recipient_email" varchar(255),
  "content" text NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "sent_at" timestamp,
  "delivered_at" timestamp,
  "error_message" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "loan_notifications_loan_idx" ON "loan_notifications" ("loan_id");
CREATE INDEX IF NOT EXISTS "loan_notifications_customer_idx" ON "loan_notifications" ("customer_id");
CREATE INDEX IF NOT EXISTS "loan_notifications_type_idx" ON "loan_notifications" ("notification_type");
CREATE INDEX IF NOT EXISTS "loan_notifications_status_idx" ON "loan_notifications" ("status");

-- ============================================================================
-- SEED DEFAULT NOTIFICATION TEMPLATES
-- ============================================================================

INSERT INTO "notification_templates" ("template_code", "template_name", "channel", "body_template", "variables") VALUES
('loan_disbursement', 'Loan Disbursement', 'whatsapp', 'Dear {{customerName}}, your gold loan of Rs {{amount}} has been disbursed. Loan No: {{loanNumber}}. Maturity Date: {{maturityDate}}. Rate: {{interestRate}}% p.a. For queries contact MARI Jewellers.', '["customerName", "amount", "loanNumber", "maturityDate", "interestRate"]'),
('payment_reminder', 'Payment Reminder', 'whatsapp', 'Reminder: Your gold loan {{loanNumber}} interest payment of Rs {{dueAmount}} is due on {{dueDate}}. Outstanding: Rs {{outstanding}}. Please ensure timely payment.', '["loanNumber", "dueAmount", "dueDate", "outstanding"]'),
('ltv_alert', 'LTV Alert', 'whatsapp', 'Alert: Your gold loan {{loanNumber}} LTV has reached {{currentLtv}}% (limit: {{maxLtv}}%). Please make a partial payment of Rs {{requiredPayment}} by {{deadline}} to maintain safe limits.', '["loanNumber", "currentLtv", "maxLtv", "requiredPayment", "deadline"]'),
('maturity_warning', 'Maturity Warning', 'whatsapp', 'Your gold loan {{loanNumber}} is maturing on {{maturityDate}}. Outstanding: Rs {{outstanding}}. Please arrange for settlement or renewal. Contact us to discuss options.', '["loanNumber", "maturityDate", "outstanding"]'),
('overdue_notice', 'Overdue Notice', 'whatsapp', 'IMPORTANT: Your gold loan {{loanNumber}} is overdue by {{overdueDays}} days. Outstanding: Rs {{outstanding}} (includes penalty). Please settle immediately to avoid further action.', '["loanNumber", "overdueDays", "outstanding"]'),
('release_confirmation', 'Release Confirmation', 'whatsapp', 'Your gold items pledged against loan {{loanNumber}} have been released. Total settled: Rs {{totalPaid}}. Thank you for choosing MARI Jewellers.', '["loanNumber", "totalPaid"]'),
('renewal_confirmation', 'Renewal Confirmation', 'whatsapp', 'Your loan {{oldLoanNumber}} has been renewed. New Loan No: {{newLoanNumber}}. New Amount: Rs {{newAmount}}. New Maturity: {{maturityDate}}. Rate: {{interestRate}}% p.a.', '["oldLoanNumber", "newLoanNumber", "newAmount", "maturityDate", "interestRate"]'),
('auction_notice', 'Auction Notice', 'whatsapp', 'FINAL NOTICE: Your gold loan {{loanNumber}} is in default. Pledged items will be auctioned on {{auctionDate}} unless settled by {{deadline}}. Outstanding: Rs {{outstanding}}. Contact us immediately.', '["loanNumber", "auctionDate", "deadline", "outstanding"]')
ON CONFLICT DO NOTHING;
