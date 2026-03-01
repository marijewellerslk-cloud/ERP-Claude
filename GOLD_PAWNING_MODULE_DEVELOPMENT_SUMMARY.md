# Gold Pawning Module - Development Summary

**Module**: Gold Pawning / Gold Loan Management
**ERP System**: MARI Jewellers ERP
**Stack**: Next.js 14 (App Router) + Express.js + Drizzle ORM + PostgreSQL + Redis
**Date**: February 2026

---

## 1. Overview

The Gold Pawning module is a comprehensive loan management system built specifically for jewellers who accept gold as collateral for loans. It handles the full lifecycle of gold-backed loans: application, disbursement, interest accrual, LTV (Loan-to-Value) monitoring, margin calls, renewals, and auction/foreclosure of defaulted loans.

The module is designed with **Sri Lankan regulatory compliance** in mind, enforcing LTV limits based on loan amount tiers, and maintaining a full audit trail of all LTV recalculations, margin calls, and notifications.

---

## 2. Database Schema (Migration 0022)

**File**: `apps/api/src/db/migrations/0022_gold_pawning_module.sql`

### 2.1 Enhanced Existing Tables

#### `gold_loans` (16 new columns added)
| Column | Type | Purpose |
|--------|------|---------|
| `loan_type` | varchar(20) | Loan structure: `bullet`, `emi`, `interest_only` |
| `interest_rate_config_id` | uuid (FK) | Links to `loan_interest_rates` for rate slab |
| `disbursement_date` | timestamp | When the loan was actually disbursed |
| `disbursement_method` | varchar(50) | Cash, bank transfer, cheque, etc. |
| `disbursement_reference` | varchar(255) | Transaction reference number |
| `original_ltv` | decimal(5,2) | LTV at the time of loan creation |
| `current_ltv` | decimal(5,2) | Current LTV (recalculated periodically) |
| `ltv_status` | varchar(20) | `safe`, `warning`, or `breach` |
| `total_gold_value` | decimal(12,2) | Current market value of all pledged gold |
| `kyc_verified` | boolean | Whether customer KYC is complete |
| `accrued_interest` | decimal(12,2) | Running interest accrual |
| `last_interest_calc_date` | timestamp | When interest was last calculated |
| `total_interest_paid` | decimal(12,2) | Sum of all interest payments made |
| `total_penalty_paid` | decimal(12,2) | Sum of all penalty payments made |
| `outstanding_balance` | decimal(12,2) | Current outstanding (principal + interest - payments) |
| `renewal_count` | integer | Number of times this loan has been renewed |
| `parent_loan_id` | uuid | Link to original loan if this is a renewal |
| `internal_notes` | text | Staff notes |

**Indexes added**: `ltv_status`, `maturity_date`

#### `pledged_gold` (15 new columns added)
| Column | Type | Purpose |
|--------|------|---------|
| `item_type` | varchar(50) | Ring, chain, bangle, coin, bar, etc. |
| `quantity` | integer | Number of items |
| `stone_weight` | decimal(10,3) | Weight of stones to deduct |
| `purity_percentage` | decimal(5,2) | Purity as percentage (e.g., 91.6 for 22K) |
| `fine_gold_equivalent` | decimal(10,4) | Net weight x purity = fine gold content |
| `gold_rate_at_pledge` | decimal(10,2) | Gold rate when item was pledged |
| `current_market_value` | decimal(12,2) | Current value at latest gold rate |
| `is_hallmarked` | boolean | BIS hallmark present |
| `hallmark_number` | varchar(50) | Hallmark ID |
| `huid_number` | varchar(50) | Hallmark Unique Identification Number |
| `storage_location` | varchar(100) | Vault/locker location |
| `seal_number` | varchar(50) | Sealed packet number |
| `is_released` | boolean | Whether item has been returned |
| `released_at` | timestamp | When released |
| `released_to` | varchar(255) | Who collected the item |

### 2.2 New Tables (9 tables)

#### `loan_interest_rates`
Configurable interest rate slabs per store. Each slab defines:
- Loan amount range (`min_amount` to `max_amount`)
- Annual/monthly/daily rate (auto-calculated from annual)
- Penalty rate for overdue loans
- Maximum LTV allowed for this slab
- Maximum tenure in months
- Effective date range

#### `loan_ltv_history`
Tracks every LTV recalculation with:
- Gold rate used, total gold value, outstanding amount
- Calculated LTV percentage and status
- Used for compliance audit trail and trend analysis

#### `customer_kyc`
Comprehensive KYC records per customer:
- Aadhaar number with verification status and timestamp
- PAN number with verification status
- Voter ID, passport, driving license
- Document image URLs (front/back for Aadhaar, PAN, photo, signature, address proof)
- KYC status workflow: `pending` -> `verified` / `rejected`
- Verification level: `basic`, `enhanced`, `full`
- Expiry tracking

#### `loan_documents`
Generated loan documents (pledge tickets, receipts, etc.):
- Document type and number (unique)
- Generated document URL and JSON data
- Print count tracking
- Email delivery tracking

#### `loan_renewals`
Records each loan renewal event:
- Links original loan to new loan
- Captures outstanding at renewal, interest paid
- New loan terms (amount, rate, tenure)
- Gold revaluation data (new value, new LTV)

#### `margin_calls`
LTV breach management:
- Trigger reason and gold rate at time of call
- LTV at call and required payment amount
- 7-day compliance deadline
- Payment tracking and compliance status
- Escalation to auction flag
- Notification tracking

#### `loan_auctions`
Foreclosure/auction process for defaulted loans:
- Auction lifecycle: `initiated` -> `completed`/`cancelled`
- Notice tracking (date, type)
- Release deadline (7 days per RBI)
- Daily penalty accrual
- Auction details: location, scheduled date, reserve price
- Sale outcome: final price, buyer info
- Financial settlement: amount recovered, surplus/deficit

#### `notification_templates`
Reusable message templates for WhatsApp/SMS/email:
- Template code, name, channel
- Body with `{{variable}}` placeholders
- Variable list for validation
- 8 pre-seeded templates (disbursement, payment reminder, LTV alert, maturity warning, overdue notice, release confirmation, renewal confirmation, auction notice)

#### `loan_notifications`
Notification delivery log:
- Loan and customer linkage
- Notification type and channel
- Recipient details (phone/email)
- Delivery status: `pending` -> `sent` -> `delivered` / `failed`
- Error message tracking

---

## 3. RBAC Permissions

**File**: `packages/shared/src/constants/permissions.ts`

### New Resources
| Resource | Description |
|----------|-------------|
| `loan_config` | Interest rate configuration |
| `loan_kyc` | KYC document management |
| `loan_auctions` | Auction/foreclosure process |
| `loan_documents` | Loan document generation |
| `margin_calls` | Margin call management |

### New Actions
| Action | Description |
|--------|-------------|
| `verify` | Verify KYC documents |
| `initiate_auction` | Start auction process |
| `waive` | Waive margin call or penalty |
| `disburse` | Disburse loan amount |
| `renew` | Renew/extend loan |

### Pre-defined Permission Sets
- **LOAN_OFFICER**: Can create/read/update loans, manage KYC, view margin calls, disburse loans
- **LOAN_MANAGER**: Full access to all loan resources including auctions and configuration

---

## 4. Backend Services

### 4.1 Gold Pawning Service (~1,100+ lines)
**File**: `apps/api/src/services/gold-pawning.service.ts`

This is the core business logic service. Key capabilities:

#### Interest Rate Configuration
- `getInterestRates(storeId)` - List all active rate slabs for a store
- `createInterestRate(storeId, data, userId)` - Create a new rate slab (auto-calculates monthly/daily rates from annual)
- `updateInterestRate(rateId, data)` - Update existing rate
- `getApplicableRate(storeId, loanAmount)` - Find the right rate slab for a given loan amount (considers effective dates)

#### LTV Management (Loan-to-Value)
- `getRbiMaxLtv(loanAmount)` - Returns RBI-mandated maximum LTV based on amount tier:
  - Up to Rs 2,50,000: 85%
  - Rs 2,50,001 to Rs 5,00,000: 80%
  - Above Rs 5,00,000: 75%
- `calculateLTV(loanId)` - Calculates current LTV using:
  - Latest gold rate from `metalAccountingService`
  - Net weight x purity factor x gold rate for each pledged item
  - Outstanding balance / total gold value x 100
  - Returns status: `safe` (< 90% of max), `warning` (90-100% of max), `breach` (>= max)
- `validateLTV(loanAmount, goldValue, maxLtv?)` - Pre-creation validation with suggested max loan amount
- `recalculateLoanLTV(loanId)` - Recalculates and persists to `loan_ltv_history` + updates `gold_loans` record
- `getLtvHistory(loanId)` - Returns last 90 LTV calculation records
- `getLtvAlerts(storeId)` - All loans with `warning` or `breach` status, sorted by LTV descending

#### Interest Accrual
- `calculateInterestAccrual(principal, rate, fromDate, toDate, penaltyRate, isOverdue)` - Pure calculation:
  - Daily rate = annual / 365
  - Penalty applies only when overdue (separate from regular interest)
- `accrueInterestForAllLoans(storeId)` - Batch job: iterates all active/margin_call loans, calculates accrued interest, updates `outstanding_balance`. Returns `{ processed, errors }` count.

#### Margin Calls
- `createMarginCall(loanId, ltv, userId)` - Creates a margin call when LTV breaches:
  - Calculates payment needed to bring LTV back to 85% of max allowed
  - Sets 7-day compliance deadline
  - Updates loan status to `margin_call`
- `recordMarginCallCompliance(callId, paymentAmount)` - Records payment against a margin call. If total payments >= required, marks as `complied` and restores loan to `active`.
- `getPendingMarginCalls(storeId)` - All pending calls with loan and customer details, sorted by deadline
- `checkMarginCalls(storeId)` - **Scheduler-ready**: Iterates all active loans, recalculates LTV, creates margin calls for any breaches (skips if pending call already exists). Returns `{ checked, callsCreated }`.

#### Loan Renewals
- `renewLoan(loanId, storeId, data, userId)` - Full transactional renewal:
  1. Validates original loan exists and is active
  2. Checks interest payment >= required
  3. Revalues gold at current market rate
  4. Validates new LTV against RBI limits
  5. Closes original loan (status: `renewed`)
  6. Creates new loan with fresh terms
  7. Transfers all pledged gold items to new loan (with updated market values)
  8. Records in `loan_renewals` with full audit data
- `getRenewalHistory(loanId)` - Full chain of renewals for a loan

#### Auctions / Foreclosure
- `initiateAuction(loanId, userId)` - Starts the auction process:
  - Sets 7-day release deadline (RBI requirement)
  - Reserve price = outstanding balance
  - Updates loan status to `auction_initiated`
- `completeAuction(auctionId, data, userId)` - Records auction completion:
  - Final sale price, buyer details
  - Calculates surplus (refunded to borrower) or deficit (still owed)
  - Releases all pledged gold items
  - Closes the loan
- `getAuctions(storeId)` - All auctions for a store with loan and customer data

#### Dashboard & Reports
- `getDashboardStats(storeId)` - Aggregate stats: total/active loans, disbursed, outstanding, pledged gold weight/value, overdue count, margin call count, average LTV, breach count
- `getOverdueLoans(storeId)` - Loans past maturity date
- `getMaturingLoans(storeId, withinDays)` - Loans maturing within N days (default 7)

### 4.2 KYC Service (~400 lines)
**File**: `apps/api/src/services/kyc.service.ts`

- `getCustomerKyc(customerId)` - Retrieve KYC record
- `createOrUpdateKyc(customerId, storeId, data)` - Upsert KYC data with document URLs
- `verifyDocument(kycId, documentType, isValid, verifiedBy)` - Mark a specific document as verified/rejected
- `updateKycStatus(kycId, status, verifiedBy, rejectionReason?)` - Overall KYC status update
- `getKycPendingLoans(storeId)` - All active loans where KYC is not yet complete
- `isKycComplete(customerId)` - Boolean check for loan eligibility

### 4.3 Loan Notification Service (~460 lines)
**File**: `apps/api/src/services/loan-notification.service.ts`

- `getTemplates(channel?)` - List notification templates, optionally filtered by channel
- `sendLoanNotification(loanId, notificationType, channel, overrides?)` - Send a notification using templates:
  - Resolves template by type + channel
  - Substitutes variables (customer name, loan number, amounts, dates)
  - Dispatches via WhatsApp/SMS/email service
  - Logs to `loan_notifications` table
- `sendBulkReminders(storeId, type, channel)` - Sends reminders to all eligible loans
- `sendMaturityReminder(loanId)` - Convenience method for maturity notifications
- `sendPaymentReminder(loanId)` - Convenience method for overdue payment notifications
- `getNotificationHistory(loanId)` - All notifications sent for a loan

---

## 5. API Controller & Routes

### 5.1 Controller
**File**: `apps/api/src/modules/pawning/pawning.controller.ts`

32 endpoint methods organized into sections. Each method:
- Validates authentication via `req.user`
- Delegates to the appropriate service
- Returns `{ success: true, data }` or `{ success: false, error: { code, message } }`

### 5.2 Routes
**File**: `apps/api/src/modules/pawning/pawning.routes.ts`

All routes are mounted at `/api/v1/pawning/` and require authentication + RBAC permissions.

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| **Dashboard** | | | |
| GET | `/dashboard/stats` | gold_loans:read | Dashboard statistics |
| GET | `/dashboard/overdue` | gold_loans:read | Overdue loans list |
| GET | `/dashboard/maturing` | gold_loans:read | Loans maturing soon |
| GET | `/dashboard/ltv-alerts` | gold_loans:read | LTV warning/breach alerts |
| **Interest Rates** | | | |
| GET | `/interest-rates` | loan_config:read | List all rate slabs |
| POST | `/interest-rates` | loan_config:create | Create rate slab |
| GET | `/interest-rates/applicable` | gold_loans:read | Find applicable rate |
| PUT | `/interest-rates/:rateId` | loan_config:update | Update rate slab |
| **LTV** | | | |
| POST | `/ltv/validate` | gold_loans:read | Pre-creation LTV check |
| GET | `/ltv/:loanId` | gold_loans:read | Current LTV calculation |
| POST | `/ltv/:loanId/recalculate` | gold_loans:update | Force LTV recalculation |
| GET | `/ltv/:loanId/history` | gold_loans:read | LTV history timeline |
| **Interest** | | | |
| POST | `/interest/calculate` | gold_loans:read | Calculate interest for display |
| POST | `/interest/accrue-all` | gold_loans:update | Manual batch accrual trigger |
| **KYC** | | | |
| GET | `/kyc-pending` | loan_kyc:read | Loans with incomplete KYC |
| GET | `/kyc/:customerId` | loan_kyc:read | Customer KYC record |
| POST | `/kyc/:customerId` | loan_kyc:create | Create/update KYC |
| POST | `/kyc/:kycId/verify` | loan_kyc:verify | Verify KYC document |
| PUT | `/kyc/:kycId/status` | loan_kyc:update | Update KYC status |
| **Margin Calls** | | | |
| GET | `/margin-calls` | margin_calls:read | Pending margin calls |
| POST | `/margin-calls/check-all` | margin_calls:create | Check all loans for breaches |
| POST | `/margin-calls/:loanId` | margin_calls:create | Manual margin call |
| POST | `/margin-calls/:callId/comply` | margin_calls:update | Record compliance payment |
| **Renewals** | | | |
| POST | `/renewals/:loanId` | gold_loans:renew | Renew a loan |
| GET | `/renewals/:loanId/history` | gold_loans:read | Renewal chain |
| **Auctions** | | | |
| GET | `/auctions` | loan_auctions:read | List auctions |
| POST | `/auctions/:loanId/initiate` | loan_auctions:initiate_auction | Start auction |
| POST | `/auctions/:auctionId/complete` | loan_auctions:update | Complete auction |
| **Notifications** | | | |
| POST | `/notifications/bulk-reminders` | gold_loans:update | Bulk reminder dispatch |
| GET | `/notifications/templates` | gold_loans:read | List templates |
| POST | `/notifications/:loanId/send` | gold_loans:update | Send notification |
| GET | `/notifications/:loanId/history` | gold_loans:read | Notification log |

---

## 6. Frontend Pages (7 pages)

All pages use:
- `'use client'` directive (Next.js App Router)
- `apiClient` (Axios instance with auth interceptor)
- `formatCurrency()` for Sri Lankan Rupee formatting
- Tailwind CSS for styling
- shadcn/ui components (`Card`, `Button`, `Badge`, `Input`, `Label`)
- Lucide React icons

### 6.1 Gold Pawning Dashboard
**File**: `apps/web/src/app/(dashboard)/loans/page.tsx`
**Route**: `/loans`

- **Stats Row (4 cards)**: Active Loans (count + total), Total Outstanding, Pledged Gold (weight in grams + value), Average LTV (color-coded: green <65%, amber 65-80%, red >=80%)
- **Summary Row (3 cards)**: Total Disbursed, Overdue Loans (red highlight when >0), Margin Call Loans (orange highlight when >0)
- **LTV Alerts Table**: Conditionally shown when there are warning/breach loans. Displays loan number, customer name/phone, loan amount, current LTV %, status badge, and view link.
- **Two-column Layout**: Overdue Loans (red-tinted cards) and Maturing Soon (amber-tinted cards with 7-day window)
- **Quick Actions Row**: KYC Verification, Margin Calls, Auctions, Interest Rate Config (each links to its respective page)

### 6.2 Loan Detail Page
**File**: `apps/web/src/app/(dashboard)/loans/[loanId]/page.tsx`
**Route**: `/loans/:loanId`

- **Header**: Loan number with status badge, Back button, action buttons (Add Payment, Renew Loan, Send Notification)
- **Key Metrics (4 cards)**: Loan Amount, Outstanding Balance, Current LTV (color-coded), Gold Value
- **Loan Details Card**: Interest rate, tenure, monthly EMI, maturity date, loan type, application/disbursement dates, accrued interest, renewal count, KYC verification status
- **Customer Info Card**: Name, phone, email with avatar icon
- **Pledged Gold Items Table**: Description, gross/net weight, purity, gold value, appraisal value, with totals row
- **LTV Monitor Card**: Visual LTV bar meter (color-coded fill against max allowed marker), current vs max LTV, status badge, gold rate used, outstanding amount. Includes "Recalculate LTV" button.
- **LTV History Table**: Date, LTV %, gold rate, status for last 10 entries
- **Payment History Table**: Date, amount, type (EMI/interest/penalty), principal/interest split, with totals

### 6.3 New Loan Application
**File**: `apps/web/src/app/(dashboard)/loans/new/page.tsx`
**Route**: `/loans/new`

Multi-step loan application form with customer search, gold items entry, LTV pre-validation calculator, and review step. Submits to the existing loan creation endpoint.

### 6.4 KYC Verification Page
**File**: `apps/web/src/app/(dashboard)/loans/kyc/page.tsx`
**Route**: `/loans/kyc`

- Lists loans with pending KYC
- Search by loan number, customer name, or phone
- KYC status badges (Pending, Verified, Rejected)
- Links to individual customer KYC management

### 6.5 Margin Calls Management
**File**: `apps/web/src/app/(dashboard)/loans/margin-calls/page.tsx`
**Route**: `/loans/margin-calls`

- **Stats (4 cards)**: Total Calls, Pending (red), Escalated (amber), Resolved (green)
- **Filter Tabs**: All, Pending, Resolved
- **Search**: By loan number, customer name, phone
- **"Check All Loans" Button**: Triggers bulk LTV check across all active loans
- **Table**: Loan number + outstanding, customer + phone, LTV at call (color-coded), required action (collateral/repayment amounts), deadline (with overdue indicator), status badge, View link
- Overdue rows highlighted in red

### 6.6 Auction Management
**File**: `apps/web/src/app/(dashboard)/loans/auctions/page.tsx`
**Route**: `/loans/auctions`

- **Stats (4 cards)**: Total Auctions, Active (amber), Completed (green), Total Recovered
- **Filter Tabs**: All, Initiated, Completed
- **Search**: By loan number, customer name, phone
- **Table**: Loan number + amount, customer + phone, auction status badge, reserve price, release deadline (with overdue flag), sale price (with surplus/deficit indicators), View Loan link

### 6.7 Interest Rate Configuration
**File**: `apps/web/src/app/(dashboard)/loans/interest-rates/page.tsx`
**Route**: `/loans/interest-rates`

- **Regulatory Guidelines Info Card**: Displays the three LTV tier limits
- **Create/Edit Form**: Rate name, annual rate (with auto-calculated monthly/daily preview), loan amount range, penalty rate, max LTV, max tenure, effective from date
- **Rates Table**: Rate name, loan range, annual rate (+ monthly rate), penalty rate, max LTV, tenure, effective from date, active/inactive toggle, edit button

---

## 7. Navigation

**File**: `apps/web/src/components/navigation/sidebar.tsx`

The sidebar now has an expanded "Gold Pawning" section with submenu items:
- Dashboard (`/loans`)
- New Loan (`/loans/new`)
- KYC Verification (`/loans/kyc`)
- Margin Calls (`/loans/margin-calls`)
- Auctions (`/loans/auctions`)
- Interest Rates (`/loans/interest-rates`)

---

## 8. Scheduler Jobs

**File**: `apps/api/src/services/scheduler.service.ts`

Four new cron jobs added for automated loan management:

| Job | Schedule | Description |
|-----|----------|-------------|
| `daily-ltv-recalculation` | 6:00 AM daily | Iterates all active stores, recalculates LTV for every active loan using the latest gold rate, creates margin calls for any breaches |
| `daily-interest-accrual` | 2:00 AM daily | Accrues daily interest for all active and margin_call loans, updates outstanding balances |
| `margin-call-checks` | Every 4 hours | Checks all active loans for LTV breaches, creates new margin calls where none exist |
| `loan-reminders` | 9:30 AM daily | Sends maturity reminders (7-day window) and overdue payment reminders via notification service |

All jobs:
- Iterate across all active stores
- Use `try/catch` per-store to prevent one store's failure from blocking others
- Log detailed metrics (processed counts, errors, calls created)
- Use Asia/Colombo timezone

---

## 9. Bug Fixes Applied

During development, several pre-existing issues were discovered and fixed:

| File | Issue | Fix |
|------|-------|-----|
| `apps/api/src/services/margin-reports.service.ts` | Referenced non-existent columns `invoices.status`, `invoiceItems.finalPrice`, `invoices.salespersonId`, `invoices.commissionAmount` | Changed to `invoices.paymentStatus`, `invoiceItems.lineTotal`, `invoices.createdBy`, literal `0` |
| `apps/api/src/services/backup.service.ts` | Top-level import of `@aws-sdk/client-s3` (not installed) caused crash | Converted to dynamic `await import()` pattern, lazy-initialized S3 client |
| `apps/api/src/services/restore.service.ts` | Same `@aws-sdk/client-s3` top-level import issue + invalid dynamic import syntax | Converted to dynamic imports throughout, fixed `new import()` syntax |
| `apps/api/src/modules/backup/backup.controller.ts` | Wrong relative import paths (`../` instead of `../../`) | Fixed all import paths |
| `apps/api/src/modules/backup/backup.routes.ts` | Invalid import path for shared permissions | Replaced with inline constants |

---

## 10. File Inventory

### New Files Created
| File | Lines | Description |
|------|-------|-------------|
| `apps/api/src/db/migrations/0022_gold_pawning_module.sql` | ~290 | Migration with 2 table alterations + 9 new tables + 8 notification templates |
| `apps/api/src/services/gold-pawning.service.ts` | ~1,100 | Core pawning business logic |
| `apps/api/src/services/kyc.service.ts` | ~400 | KYC management |
| `apps/api/src/services/loan-notification.service.ts` | ~460 | Notification dispatch and template management |
| `apps/api/src/modules/pawning/pawning.controller.ts` | ~650 | 32 API endpoint handlers |
| `apps/api/src/modules/pawning/pawning.routes.ts` | ~240 | Route definitions with RBAC |
| `apps/web/src/app/(dashboard)/loans/page.tsx` | ~496 | Dashboard page |
| `apps/web/src/app/(dashboard)/loans/[loanId]/page.tsx` | ~768 | Loan detail page |
| `apps/web/src/app/(dashboard)/loans/new/page.tsx` | ~650+ | New loan application |
| `apps/web/src/app/(dashboard)/loans/kyc/page.tsx` | ~400+ | KYC verification |
| `apps/web/src/app/(dashboard)/loans/margin-calls/page.tsx` | ~340 | Margin calls management |
| `apps/web/src/app/(dashboard)/loans/auctions/page.tsx` | ~280 | Auction management |
| `apps/web/src/app/(dashboard)/loans/interest-rates/page.tsx` | ~420 | Interest rate configuration |

### Modified Files
| File | Changes |
|------|---------|
| `apps/api/src/app.ts` | Added pawning routes import and mount at `/api/v1/pawning` |
| `apps/api/src/db/schema.ts` | Added 9 new table definitions + enhanced `goldLoans` and `pledgedGold` |
| `apps/api/src/services/scheduler.service.ts` | Added 4 new cron jobs + gold pawning service imports |
| `apps/web/src/components/navigation/sidebar.tsx` | Replaced "Gold Loans" with "Gold Pawning" submenu (6 children) |
| `packages/shared/src/constants/permissions.ts` | Added 5 new resources, 5 new actions, 2 permission sets |

---

## 11. Loan Lifecycle State Machine

```
                    ┌──────────────────────────────────────┐
                    │                                      │
   [Application] ──>│  pending  ──> approved ──> active    │
                    │                             │   │    │
                    │                             │   │    │
                    │     ┌── margin_call <───────┘   │    │
                    │     │        │                   │    │
                    │     │   (comply)                 │    │
                    │     │        │                   │    │
                    │     └──> active ──────────────── │    │
                    │                                  │    │
                    │     (default) ──> auction_initiated   │
                    │                        │              │
                    │                   (sell/settle)       │
                    │                        │              │
                    │                     closed            │
                    │                                       │
                    │     (renew) ──> renewed               │
                    │                    │                   │
                    │              [new loan: active]       │
                    │                                       │
                    │     (pay off) ──> released             │
                    └───────────────────────────────────────┘
```

---

## 12. Key Business Rules

1. **Sri Lankan LTV Compliance**: LTV limits are enforced at loan creation, renewal, and monitored continuously. The system never allows a loan with LTV exceeding regulatory limits.

2. **Margin Call Workflow**: When LTV breaches the maximum:
   - Margin call is created with required payment amount
   - 7-day compliance deadline
   - If not complied, can be escalated to auction
   - Payment brings loan back to 85% of max LTV (not just below threshold)

3. **Interest Accrual**: Simple interest calculated daily (rate/365 x principal). Penalty interest applies only to overdue loans at a separate rate.

4. **Loan Renewal**: Full transactional process - old loan closed, new loan created with same collateral. Gold is revalued at current market rate. LTV re-validated.

5. **Auction Process**: 7-day notice period (RBI requirement). Reserve price = outstanding balance. Surplus returned to borrower, deficit tracked as receivable.

6. **Gold Valuation**: `net_weight x (purity% / 100) x current_gold_rate` per item. Total across all pledged items determines collateral value.

---

## 13. Testing Notes for Dev Team

### Areas to Test
1. **LTV Calculation Accuracy**: Create loans with known gold weights/purities and verify LTV matches manual calculation
2. **Margin Call Trigger**: Lower gold rate and verify margin calls are automatically created by scheduler
3. **Interest Accrual**: Verify daily interest matches `principal x annual_rate / 365 x days`
4. **Renewal Transaction**: Ensure old loan is properly closed and new loan has correct terms
5. **Auction Surplus/Deficit**: Verify arithmetic when sale price > or < outstanding
6. **Permission Guards**: Test that LOAN_OFFICER cannot access config or auctions
7. **Concurrent LTV Recalculation**: Verify scheduler handles multiple stores without interference

### Known Limitations
- WhatsApp notifications log only (WhatsApp API credentials not yet configured)
- Email notifications log only (email service credentials not configured)
- Gold rate is fetched from `metalAccountingService` - ensure gold rates are being updated regularly
- `@aws-sdk/client-s3` is not installed - backup/restore cloud features use dynamic imports and will fail gracefully if not installed
