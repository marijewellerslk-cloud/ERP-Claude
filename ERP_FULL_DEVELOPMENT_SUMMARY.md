# MARI Jewellers ERP - Complete Development Summary

## 🚨 CRITICAL: Database Wipe Fix (February 16, 2026)

### Problem Resolved
**Issue**: Database was being completely wiped on every deploy/update, causing:
- Total data loss (admin users, customers, inventory, orders)
- Admin login lockout
- Production outages

**Root Cause**: Seed script (`db:seed`) running during deployment without proper safety checks

**Status**: ✅ **FIXED** - Emergency patches applied

### Safe Deployment Commands

```bash
# ✅ SAFE for production deployments:
npm run db:init          # Migrations + admin check (SAFE)
npm run db:seed:safe     # Only recreate admin (SAFE)
npm run db:prepare       # Migrate + seed:safe (SAFE)

# ❌ BLOCKED in production:
npm run db:seed          # Original seed (now has safety checks)
```

### Emergency Admin Recovery

```bash
# Recreate admin with default password
npm run script:recreate-admin

# Or with custom credentials
npm run script:recreate-admin -- --email admin@marijewellers.com --password NewSecure@123
```

### Pre-Deployment Checklist

```bash
# □ 1. Verify seed script blocked
NODE_ENV=production npm run db:seed 2>&1 | grep "CRITICAL SAFETY"

# □ 2. Verify init script works
npm run db:init

# □ 3. Verify admin recreation
npm run script:recreate-admin

# □ 4. Verify data persists
docker-compose restart postgres && psql $DATABASE_URL -c "SELECT count(*) FROM users"

# □ 5. Verify migrations non-destructive
npm run db:generate && cat migrations/* | grep -i DROP

# □ 6. Verify volume persistent
docker volume inspect mari-erp-postgres_data

# □ 7. Test in staging first

# □ 8. Create backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# □ 9. Review rollback docs
cat DATABASE_WIPE_FIX.md

# □ 10. Notify team
```

### Documentation
- `DATABASE_WIPE_FIX.md` - Emergency deployment guide
- `DATABASE_WIPE_COMPLETE_FIX.md` - Full analysis and long-term fix

---

## Executive Overview

This document provides a comprehensive technical overview of the **MARI Jewellers ERP System**, a full-stack enterprise resource planning application built specifically for the jewellery retail and manufacturing industry. The system manages inventory, sales, customer relationships, gold loans (pawning), accounting, human resources, and manufacturing operations across multiple stores.

**Project Scale:**
- **90+ Database Tables** across 25+ migrations
- **23+ API Modules** with 320+ endpoints
- **25+ Backend Services** with 310+ methods
- **90+ Frontend Pages** across 16+ major modules
- **7 Role-Based Access Control** levels
- **12+ Scheduled Background Jobs**
- **Multi-store / Multi-tenant** architecture

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Infrastructure & DevOps](#infrastructure--devops)
4. [Database Schema](#database-schema)
5. [API Modules & Endpoints](#api-modules--endpoints)
6. [Backend Services](#backend-services)
7. [Frontend Application](#frontend-application)
8. [Authentication & Authorization](#authentication--authorization)
9. [Scheduled Jobs & Automation](#scheduled-jobs--automation)
10. [Key Business Features](#key-business-features)
11. [Module-by-Module Breakdown](#module-by-module-breakdown)

---

## Architecture Overview

### Monorepo Structure

The application uses **Turborepo** for monorepo management with the following structure:

```
/
├── apps/
│   ├── api/          # Express.js Backend API
│   └── web/          # Next.js 14 Frontend (App Router)
├── packages/
│   └── shared/       # Shared TypeScript types, constants, utilities
├── docker-compose.yml
└── package.json
```

### Architecture Pattern

- **Backend:** RESTful API with Express.js
- **Frontend:** Server-Side Rendered (SSR) with Next.js 14 App Router
- **Database:** PostgreSQL 16 with Drizzle ORM
- **Caching Layer:** Redis 7 for sessions and caching
- **Object Storage:** MinIO (S3-compatible) for backups and media
- **Authentication:** JWT-based with HTTP-only cookies
- **Authorization:** Resource-Action based RBAC with store-scoped permissions

### Multi-Tenancy Model

The system implements **store-scoped multi-tenancy** where:
- Most database tables include a `storeId` foreign key
- Users are assigned to one or more stores via `userRoles` table
- API middleware enforces store access control
- Command Center provides cross-store aggregation for owners/admins

---

## Technology Stack

### Backend (`apps/api`)

| Category | Technology | Version |
|----------|-----------|---------|
| **Runtime** | Node.js | ≥18.0.0 |
| **Framework** | Express.js | Latest |
| **Database** | PostgreSQL | 16 |
| **ORM** | Drizzle ORM | Latest |
| **Caching** | Redis | 7 |
| **Validation** | Zod | Latest |
| **Authentication** | jsonwebtoken | Latest |
| **Password Hashing** | bcrypt | Latest |
| **Scheduling** | node-cron | Latest |
| **Email** | nodemailer | Latest |
| **WhatsApp** | @green-api/whatsapp-api-client | Latest |
| **Cloud Storage** | @aws-sdk/client-s3 (dynamic import) | Latest |

**Key Backend Features:**
- ESM modules (`"type": "module"`)
- Helmet for security headers
- Express rate limiting
- CORS with configurable origins
- Cookie parser for JWT tokens
- JSON body parsing (10MB limit)
- Compression middleware
- Request logging with winston

### Frontend (`apps/web`)

| Category | Technology | Version |
|----------|-----------|---------|
| **Framework** | Next.js | 14 |
| **UI Library** | React | 18 |
| **State Management** | Zustand | Latest |
| **Data Fetching** | @tanstack/react-query | Latest |
| **HTTP Client** | Axios | Latest |
| **Styling** | Tailwind CSS | Latest |
| **UI Components** | Radix UI + shadcn/ui | Latest |
| **Icons** | Lucide React | Latest |
| **Forms** | React Hook Form | Latest |
| **Validation** | Zod | Latest |
| **Tables** | @tanstack/react-table | Latest |
| **Charts** | Recharts | Latest |
| **PDF Generation** | jsPDF | Latest |
| **Printing** | react-to-print | Latest |
| **Notifications** | Sonner | Latest |
| **Date Handling** | date-fns | Latest |

**Key Frontend Features:**
- Next.js 14 App Router with RSC support
- Server-side rendering (SSR)
- Middleware for authentication
- shadcn/ui component library
- Responsive design with Tailwind
- Toast notifications with Sonner
- Client-side state with Zustand
- Server state with React Query

### Shared Package (`packages/shared`)

**Exports:**
- Type definitions (`User`, `Store`, `Role`, `Permission`)
- Constants (`ROLES`, `PERMISSIONS`, `RESOURCES`, `ACTIONS`)
- Utility functions (`hasHigherOrEqualRole`, `canManageRole`)
- Permission sets (`EMPLOYEE_HRM`, `FULL_HRM`, `LOAN_OFFICER`, etc.)

---

## Infrastructure & DevOps

### Docker Compose Configuration

The application runs three containerized services:

#### 1. PostgreSQL Database
```yaml
Image: postgres:16-alpine
Port: 5432
Volume: postgres_data
Features:
  - UTF-8 encoding
  - Asia/Colombo timezone
  - Persistent volume storage
```

#### 2. Redis Cache
```yaml
Image: redis:7-alpine
Port: 6379
Volume: redis_data
Features:
  - AOF persistence enabled
  - Session storage
  - Cache layer
```

#### 3. MinIO Object Storage
```yaml
Image: minio/minio:latest
Ports: 9000 (API), 9001 (Console)
Volume: minio_data
Features:
  - S3-compatible API
  - Database backup storage
  - Media file storage
  - Web console UI
```

### Environment Configuration

**Required Environment Variables:**
```
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mari_erp
POSTGRES_USER=mari_erp_user
POSTGRES_PASSWORD=secure_password
POSTGRES_DB=mari_erp

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=noreply@marijewellers.com

# WhatsApp (Green API)
WHATSAPP_INSTANCE_ID=your_instance_id
WHATSAPP_API_TOKEN=your_api_token

# MinIO / S3
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
BACKUP_BUCKET_NAME=erp-backups
UPLOAD_BACKUPS_TO_CLOUD=true

# Application
NODE_ENV=production
PORT=3001
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000

# Backup
BACKUP_DIR=./backups
TEMP_RESTORE_DIR=./temp_restores
BACKUP_RETENTION_DAYS=30

# Localization
TIMEZONE=Asia/Colombo
CURRENCY=LKR
```

### Scripts & Commands

**Root Package:**
```bash
# Development
npm run dev              # Start all services in dev mode
npm run build            # Build all packages
npm run docker:up        # Start Docker services
npm run docker:down      # Stop Docker services

# Database (SAFE for production)
npm run db:init          # Initialize database safely (migrations + admin check)
npm run db:migrate       # Run database migrations
npm run db:seed:safe     # Safe seed - only recreates admin user
npm run db:prepare       # Full safe setup (migrate + seed:safe)
npm run db:studio        # Open Drizzle Studio

# Database (DEVELOPMENT ONLY - blocked in production)
npm run db:seed          # Full seed with initial data (BLOCKED in production)

# Scripts
npm run script:recreate-admin  # Recreate admin user (safe, idempotent)
```

**API Package:**
```bash
# Development
npm run dev              # Development server with nodemon
npm run build            # Compile TypeScript
npm run start            # Production server

# Database (SAFE for production)
npm run db:init          # Initialize database safely (migrations + admin check)
npm run db:migrate       # Run migrations
npm run db:seed:safe     # Safe seed - only recreates admin user
npm run db:prepare       # Full safe setup (migrate + seed:safe)
npm run db:studio        # Database GUI

# Database (DEVELOPMENT ONLY - blocked in production)
npm run db:seed          # Full seed with initial data (BLOCKED in production)

# Utility Scripts
npm run script:recreate-admin    # Recreate admin user
npm run script:reset-admin-password # Reset admin password
```

**Web Package:**
```bash
npm run dev              # Next.js dev server
npm run build            # Production build
npm run start            # Production server
npm run lint             # ESLint check
```

**⚠️ IMPORTANT: Production Deployment Safety**

The `db:seed` script is now **blocked** in production environments to prevent accidental data loss. Use these commands instead:

```bash
# For production deployments:
npm run db:init          # Safe initialization
npm run db:seed:safe     # Ensure admin exists (idempotent)

# If admin is locked out:
npm run script:recreate-admin  # Recreate admin without wiping data
```

See `DATABASE_WIPE_FIX.md` for complete deployment procedures.

---

## Database Schema

### Overview

The database consists of **86+ tables** organized into 24+ logical domains:

### 1. Authentication & Multi-Tenancy (8 tables)

| Table | Description |
|-------|-------------|
| `users` | System users with email, password hash, role assignments |
| `stores` | Store/branch locations with hierarchy support |
| `roles` | Role definitions (super_admin, owner, store_manager, etc.) |
| `permissions` | Permission definitions (resource:action pairs) |
| `rolePermissions` | Role-to-permission mappings |
| `userRoles` | User-to-role assignments (store-scoped) |
| `sessions` | Active user sessions with expiry tracking |
| `auditLogs` | Complete audit trail of user actions with old/new values |

**Key Fields:**
- `users`: `id`, `email`, `passwordHash`, `firstName`, `lastName`, `phone`, `isActive`, `createdAt`, `updatedAt`
- `stores`: `id`, `code`, `name`, `address`, `city`, `state`, `gstin`, `parentStoreId`, `isActive`
- `roles`: `id`, `name`, `level` (hierarchy: 1-7)
- `permissions`: `id`, `resource`, `action`

### 2. Inventory Management (7 tables)

| Table | Description |
|-------|-------------|
| `inventoryCategories` | Product categories (rings, necklaces, bracelets, etc.) |
| `inventoryItems` | Individual jewellery items with fine gold tracking |
| `stones` | Gemstones/diamonds associated with items |
| `inventoryBatches` | Purchase batches (monetary or gold exchange) |
| `inventoryBatchItems` | Items within a batch with costing |
| `stockLevels` | Current stock quantities per store |
| `stockMovements` | Historical stock transfers and adjustments |

**Key Fields (`inventoryItems`):**
- Basic: `id`, `storeId`, `sku`, `batchId`, `name`, `categoryId`, `itemType`
- Metal: `metalType`, `metalPurity`, `grossWeight`, `netWeight`, `stoneWeight`
- Costing: `costPerGram`, `totalCost`, `makingCharges`, `gstRate`
- Fine Gold: `fineGoldEquivalent` (calculated from purity × net weight)
- Valuation: `lastValuationDate`, `currentMarketValue`, `unrealizedGainLoss`
- Status: `status` (available, sold, reserved, damaged), `soldAt`, `soldPrice`

**Batch Types:**
- `monetary`: Traditional purchase with payment
- `gold_exchange`: Gold-for-gold transactions with suppliers

### 3. Customer CRM (13 tables)

| Table | Description |
|-------|-------------|
| `customers` | Customer master with contact and tier information |
| `customerAddresses` | Multiple addresses per customer |
| `loyaltyTransactions` | Points earned/deducted with running balance |
| `customerWishlists` | Customer wish lists (item-specific or custom criteria) |
| `customerBuyingHabits` | RFM analysis and churn prediction |
| `customerReferrals` | Referral program tracking |
| `loyaltyRewardsCatalog` | Available rewards (service, discount, product) |
| `loyaltyRewardRedemptions` | Redeemed rewards with codes |
| `whatsappLeads` | Leads from WhatsApp inquiries |
| `whatsappMessages` | Message history (sent/received) |

**Loyalty Tiers:** Bronze (0-4999), Silver (5000-14999), Gold (15000-29999), Platinum (30000+)

**RFM Segments:**
- Champions, Loyal Customers, Potential Loyalist
- At Risk, Can't Lose Them, Hibernating
- Lost, Promising, Need Attention, About to Sleep

**Buying Habits Metrics:**
- Recency, Frequency, Monetary scores (1-5)
- Average order value, total lifetime value
- Preferred metal type, budget tier
- Days since last purchase, churn risk score

### 4. Sales & Invoicing (5 tables)

| Table | Description |
|-------|-------------|
| `goldRates` | Daily gold rates by purity (22K, 24K, etc.) |
| `invoices` | Sales invoices with customer and payment info |
| `invoiceItems` | Line items with ROI/margin metrics |
| `payments` | Payment records for invoices/batches/loans |
| `quotations` | Price quotations for customers |

**Invoice Items ROI Fields:**
- `metalCostAtSale`: Gold rate at time of sale
- `metalMarginGrams`: Fine gold margin (sale rate - purchase rate) × weight
- `holdingPeriodDays`: Days from purchase to sale
- `effectiveROI`: Annualized return on investment
- `grossMargin`: Total profit including making charges

### 5. Gold Loans / Pawning (13 tables)

| Table | Description |
|-------|-------------|
| `goldLoans` | Loan master with amount, interest, maturity |
| `pledgedGold` | Collateral items with fine gold calculation |
| `loanPayments` | Payment history (principal/interest) |
| `loanReleases` | Loan closure records |
| `loanInterestRates` | Tiered interest rate configuration |
| `loanLtvHistory` | LTV calculation history |
| `customerKyc` | KYC documents (Aadhaar, PAN) |
| `loanDocuments` | Supporting documents storage |
| `loanRenewals` | Loan renewal history |
| `marginCalls` | LTV breach notifications |
| `loanAuctions` | Foreclosure auction records |
| `notificationTemplates` | SMS/WhatsApp templates |
| `loanNotifications` | Sent notification log |

**RBI LTV Compliance:**
- ≤ ₹2,50,000: 85% max LTV
- ₹2,50,001 - ₹5,00,000: 80% max LTV
- > ₹5,00,000: 75% max LTV

**Interest Calculation:**
- Daily accrual based on annual/monthly/daily rate
- Penalty rates for overdue loans
- Compound interest tracking

### 6. Suppliers (3 tables)

| Table | Description |
|-------|-------------|
| `suppliers` | Supplier master with dual ledger (monetary + gold) |
| `purchasePayments` | Payments made to suppliers |
| `supplierAccountTransactions` | Unified ledger with fine gold tracking |

**Dual Ledger System:**
- Monetary: `currentBalance`, `totalPurchases`, `totalPaid`
- Gold: `goldBalanceGrams`, `totalGoldReceived`, `totalGoldReturned`
- Gold Exchange: `goldExchangeBalanceGrams` (business owes supplier gold)

**Transaction Types:**
- `purchase`, `payment`, `advance`, `adjustment`
- `gold_received`, `gold_returned`, `gold_exchange`, `gold_settled`

### 7. Reporting & Activity (3 tables)

| Table | Description |
|-------|-------------|
| `dailySummaries` | Daily aggregated metrics per store |
| `emailNotifications` | Scheduled email queue |
| `activitySummaries` | Activity log for dashboard feed |

**Daily Summary Metrics:**
- Sales: total revenue, invoice count, customer count
- Inventory: items added, batches completed, gross weight
- Financial: payments received/made, outstanding amounts
- Activity: total activities, active users

### 8. Label Management (1 table)

| Table | Description |
|-------|-------------|
| `labelTemplates` | Configurable label designer templates |

**Features:**
- Page size, orientation, margins
- Labels per row/column, spacing
- Company header, borders, backgrounds
- Field positioning (x, y, width, height, fontSize)
- Default template selection

### 9. Repairs (4 tables)

| Table | Description |
|-------|-------------|
| `repairs` | Repair jobs with status workflow |
| `repairItems` | Items being repaired |
| `repairStages` | Stage history (received → assessed → in_progress → ready → delivered) |
| `exchangeValuations` | Old item exchange valuations |

### 10. Custom Orders (4 tables)

| Table | Description |
|-------|-------------|
| `customOrders` | Custom design orders |
| `customOrderItems` | Items in custom order |
| `customOrderStages` | Stage workflow tracking |
| `customOrderDesignVersions` | Design iteration history |

**Stages:** inquiry → design → quotation → approved → in_production → quality_check → ready → delivered

### 11. Accounting (7 tables)

| Table | Description |
|-------|-------------|
| `accounts` | Chart of accounts (hierarchical) |
| `bankAccounts` | Bank account master |
| `journalEntries` | Double-entry journal entries |
| `journalEntryLines` | Debit/credit lines |
| `expenses` | Expense tracking with GST |
| `cashRegister` | Daily cash register sessions |
| `financialPeriods` | Accounting periods (monthly/yearly) |

**Account Types:** Asset, Liability, Equity, Income, Expense

**Triple-Entry Bookkeeping:**
- Currency (LKR)
- Weight (grams)
- Fine Gold Equivalent (24K grams)

### 12. Human Resources (7 tables)

| Table | Description |
|-------|-------------|
| `employees` | Employee master with salary info |
| `attendance` | Daily attendance records |
| `leaveTypes` | Leave type configuration |
| `leaveRequests` | Leave applications |
| `leaveBalances` | Leave balance tracking |
| `payroll` | Monthly payroll records |
| `salaryAdvances` | Salary advance requests |

**Employment Types:** permanent, contract, part_time

### 13. Karigars (Artisans) (3 tables)

| Table | Description |
|-------|-------------|
| `karigars` | Artisan master with gold/cash balance |
| `jobCards` | Manufacturing job cards |
| `karigarTransactions` | Gold and cash movement ledger |

**Job Card Flow:**
- Issue gold → Karigar works → Return finished goods + scrap
- Track wastage (expected vs actual)
- Labour charges calculation

### 14. Scrap Management (3 tables)

| Table | Description |
|-------|-------------|
| `scrapInventory` | Accumulated scrap items |
| `meltingRecords` | Melting/refining records |
| `wastageAllowances` | Wastage rate configuration |

**Scrap Sources:** repair, exchange, manufacturing, returns

### 15. Commission (3 tables)

| Table | Description |
|-------|-------------|
| `commissionRates` | Tiered commission configuration |
| `commissionLedger` | Earned/paid commission tracking |
| `salespersonSummary` | Monthly performance summaries |

**Commission Types:**
- Percentage-based
- Fixed per item
- Category-specific rates
- Metal-specific rates (gold, silver, diamond)

### 16. Valuation (2 tables)

| Table | Description |
|-------|-------------|
| `inventoryValuations` | Mark-to-market valuation history |
| `stockAgingSnapshots` | Aging bucket snapshots |

**Aging Buckets:** 0-30, 31-60, 61-90, 91-180, 181-365, 365+ days

### 17. ROI & Margin Tracking (3 tables)

| Table | Description |
|-------|-------------|
| `reportSnapshots` | Daily report snapshots |
| `categoryPerformance` | Category-wise metrics |
| `metalProfitLoss` | Metal trading profit/loss |

**Metrics Tracked:**
- Item-level ROI (annualized)
- Gross margin percentages
- Holding period analysis
- Metal rate spreads

---

## API Modules & Endpoints

The API exposes **21+ modules** with **305+ endpoints**. All endpoints (except `/register`, `/login`, and webhook) require authentication and store-scoped permissions.

### API Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { /* response payload */ }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

### Module Summary

| Module | Base Path | Endpoints | Description |
|--------|-----------|-----------|-------------|
| Auth | `/api/v1/auth` | 5 | Login, register, refresh, logout, profile |
| Inventory | `/api/v1/inventory` | 26 | Batches, items, categories, valuation, aging |
| Sales | `/api/v1/sales` | 10 | Invoices, payments, gold rates, quotations |
| Customers | `/api/v1/customers` | 23 | CRUD, loyalty, rewards, wishlist, habits, referrals, messages |
| Leads | `/api/v1/leads` | 14 | Lead management, pipeline, conversion, WhatsApp |
| Loans | `/api/v1/loans` | 8 | Create, approve, payments, release, overdue |
| Pawning | `/api/v1/pawning` | 32 | Interest rates, LTV, KYC, margin calls, renewals, auctions, notifications |
| Suppliers | `/api/v1/suppliers` | 11 | CRUD, purchases, ledger, unified ledger (monetary + gold) |
| Labels | `/api/v1/labels` | 8 | Templates CRUD, set default, duplicate |
| Repairs | `/api/v1/repairs` | 14 | Create, status workflow, items, notifications |
| Custom Orders | `/api/v1/custom-orders` | 17 | Create, design versions, quotation, workflow, notifications |
| Accounting | `/api/v1/accounting` | 18 | Chart of accounts, journal entries, expenses, cash register, reports |
| HRM | `/api/v1/hrm` | 28 | Employees, attendance, leave, payroll, advances |
| Command Center | `/api/v1/command-center` | 12 | Multi-store dashboards, aggregation, alerts |
| Metal | `/api/v1/metal` | 6 | Metal position, fine gold conversion, backfill |
| Karigars | `/api/v1/karigars` | 7 | CRUD, ledger, payments, advances |
| Job Cards | `/api/v1/job-cards` | 6 | Create, return, settle, status |
| Scrap | `/api/v1/scrap` | 7 | Scrap inventory, melting records |
| Stores | `/api/v1/stores` | 6 | CRUD, hierarchy |
| Reports | `/api/v1/reports` | 15 | Dashboard metrics, margin analysis, ROI, stock aging, salesperson performance |
| Backups | `/api/v1/backups` | 7 | Create, list, restore, cleanup, health check |

### Sample Endpoint Details

#### Inventory Module (`/api/v1/inventory`)

```
POST   /batches                          # Create batch
GET    /batches                          # List batches
GET    /batches/:batchId                 # Get batch details
GET    /batches/:batchId/summary         # Get batch summary
POST   /batches/:batchId/items           # Add item to batch
PUT    /batches/:batchId/items/:itemId   # Update batch item
DELETE /batches/:batchId/items/:itemId   # Delete item from batch
POST   /batches/:batchId/complete        # Complete batch
DELETE /batches/:batchId                 # Delete batch
POST   /batches/:batchId/payments        # Record batch payment
GET    /batches/:batchId/payments        # Get batch payments
POST   /categories                       # Create category
GET    /categories                       # List categories
GET    /categories/statistics            # Get category statistics
PUT    /categories/:categoryId           # Update category
DELETE /categories/:categoryId           # Delete category
GET    /valuation                        # Get valuation summary
POST   /revalue                          # Revalue inventory
GET    /aging                            # Get stock aging report
GET    /dead-stock                       # Get dead stock
GET    /turnover                         # Get inventory turnover
GET    /items                            # Search items
GET    /items/sold                       # List sold items
GET    /items/:itemId                    # Get item details
PUT    /items/:itemId                    # Update item
GET    /items/:itemId/valuation          # Get item valuation details
```

#### Pawning Module (`/api/v1/pawning`)

```
GET    /dashboard/stats                  # Dashboard statistics
GET    /dashboard/overdue                # Overdue loans
GET    /dashboard/maturing               # Maturing loans
GET    /dashboard/ltv-alerts             # LTV breach alerts
GET    /interest-rates                   # List interest rates
POST   /interest-rates                   # Create interest rate
GET    /interest-rates/applicable        # Get applicable rate
PUT    /interest-rates/:rateId           # Update interest rate
POST   /ltv/validate                     # Validate LTV
GET    /ltv/:loanId                      # Calculate LTV
POST   /ltv/:loanId/recalculate          # Recalculate LTV
GET    /ltv/:loanId/history              # Get LTV history
POST   /interest/calculate               # Calculate interest
POST   /interest/accrue-all              # Accrue all interest
GET    /kyc-pending                      # Get KYC pending loans
GET    /kyc/:customerId                  # Get customer KYC
POST   /kyc/:customerId                  # Create/update KYC
POST   /kyc/:kycId/verify                # Verify KYC document
PUT    /kyc/:kycId/status                # Update KYC status
GET    /margin-calls                     # Get pending margin calls
POST   /margin-calls/check-all           # Check all margin calls
POST   /margin-calls/:loanId             # Create margin call
POST   /margin-calls/:callId/comply      # Record compliance
POST   /renewals/:loanId                 # Renew loan
GET    /renewals/:loanId/history         # Get renewal history
GET    /auctions                         # List auctions
POST   /auctions/:loanId/initiate        # Initiate auction
POST   /auctions/:auctionId/complete     # Complete auction
POST   /notifications/bulk-reminders     # Send bulk reminders
GET    /notifications/templates          # Get notification templates
POST   /notifications/:loanId/send       # Send notification
GET    /notifications/:loanId/history    # Get notification history
```

---

## Backend Services

The backend implements **22+ specialized services** with **290+ public methods**. Services are singleton instances exported from each file.

### Service Architecture

Services follow a consistent pattern:
- **Class-based** with private helper methods
- **Singleton export** at the bottom of each file
- **Database transactions** for complex operations
- **Error handling** with typed errors
- **Logging** with winston
- **Type-safe** with Zod validation

### Service Summary

| Service | File | Methods | Description |
|---------|------|---------|-------------|
| **ActivityLoggerService** | `activity-logger.service.ts` | 6 | Records activity summaries and audit logs |
| **DailySummaryService** | `daily-summary.service.ts` | 10 | Generates daily aggregated metrics |
| **EmailService** | `email.service.ts` | 4 | Sends emails with SMTP, processes queue |
| **DailyBriefingService** | `daily-briefing.service.ts` | 5 | Generates and sends daily briefings |
| **SupplierAccountService** | `supplier-account.service.ts` | 12 | Manages dual-ledger supplier accounts |
| **WhatsAppService** | `whatsapp.service.ts` | 15 | Sends WhatsApp messages, handles webhooks |
| **ReferralService** | `referral.service.ts` | 12 | Manages customer referral program |
| **WishlistService** | `wishlist.service.ts` | 13 | Handles customer wishlists, matches inventory |
| **BuyingHabitsService** | `buying-habits.service.ts` | 12 | RFM analysis, customer segmentation, churn prediction |
| **LeadService** | `lead.service.ts` | 15 | Lead management, scoring, conversion |
| **LoyaltyService** | `loyalty.service.ts` | 17 | Loyalty points, tiers, rewards catalog |
| **MetalAccountingService** | `metal-accounting.service.ts` | 9 | Fine gold calculations, metal position |
| **CostingService** | `costing.service.ts` | 6 | COGS calculations (FIFO, LIFO, WA, SI) |
| **CommissionService** | `commission.service.ts` | 11 | Commission calculation, ledger, payouts |
| **KycService** | `kyc.service.ts` | 7 | KYC verification, document management |
| **LoanNotificationService** | `loan-notification.service.ts` | 6 | Loan notification templates, bulk reminders |
| **GoldPawningService** | `gold-pawning.service.ts` | 27 | Complete gold loan lifecycle management |
| **MarginReportsService** | `margin-reports.service.ts` | 10 | ROI analysis, margin reports, snapshots |
| **StockValuationService** | `stock-valuation.service.ts` | 4 | Mark-to-market inventory valuation |
| **SchedulerService** | `scheduler.service.ts` | 17 | Manages all cron jobs, manual triggers |
| **BackupService** | `backup.service.ts` | 13 | Database backups, verification, cloud upload |
| **RestoreService** | `restore.service.ts` | 7 | Database restoration, dry-run validation |

### Key Service Highlights

#### GoldPawningService (27 methods)
The most comprehensive service handling:
- Interest rate configuration with amount-based tiers
- RBI LTV calculation and validation
- Daily interest accrual with penalties
- Margin call creation and compliance tracking
- Loan renewal with revaluation
- Foreclosure auction management
- Dashboard statistics and alerts

**Sample Methods:**
```typescript
getApplicableRate(amount: number): InterestRate
calculateLTV(loanId: string): { currentLtv: number, maxLtv: number }
accrueInterestForAllLoans(): Promise<void>
createMarginCall(loanId: string): Promise<MarginCall>
renewLoan(loanId: string, data: RenewalData): Promise<Loan>
initiateAuction(loanId: string): Promise<Auction>
```

#### BuyingHabitsService (12 methods)
Implements sophisticated customer analytics:
- RFM (Recency, Frequency, Monetary) scoring (1-5 scale)
- Customer segmentation (Champions, Loyal, At Risk, etc.)
- Churn risk prediction (0-100 score)
- Budget tier classification (economy, mid-range, premium, luxury)
- Metal preference tracking
- Average order value and lifetime value calculation

**RFM Scoring Logic:**
```
Recency Score (R): Days since last purchase
  5: 0-30 days
  4: 31-60 days
  3: 61-90 days
  2: 91-180 days
  1: 181+ days

Frequency Score (F): Number of purchases
  5: 10+ purchases
  4: 7-9 purchases
  3: 4-6 purchases
  2: 2-3 purchases
  1: 1 purchase

Monetary Score (M): Total lifetime value
  5: Top 20%
  4: 20-40%
  3: 40-60%
  2: 60-80%
  1: Bottom 20%
```

#### MetalAccountingService (9 methods)
Handles fine gold calculations and metal position:
- Converts gross weight + purity → fine gold (24K equivalent)
- Supports multiple purity formats: "22K", "916", "91.67%"
- Calculates store-wise metal position across:
  - Inventory (by purity)
  - Gold with karigars
  - Gold owed to suppliers
  - Gold in pledged loans
- Backfills fine gold for existing inventory

**Fine Gold Formula:**
```
fineGoldEquivalent = netWeight × purityFactor

Where purityFactor:
  24K: 1.0000
  22K: 0.9167
  21K: 0.8750
  18K: 0.7500
  916: 0.9160
  750: 0.7500
```

#### SchedulerService (17 methods)
Manages all automated background jobs:
1. **Daily Briefing** (8:00 AM) - Email summary to all users
2. **Pending Emails** (Every 5 min) - Process email queue
3. **Log Cleanup** (1st of month, 2:00 AM) - Delete old logs
4. **Wishlist Expiration** (Daily, midnight) - Mark expired wishlists
5. **Buying Habits Recalculation** (Weekly, Sunday 3:00 AM) - RFM scores
6. **Lead Follow-up Reminders** (Daily, 9:00 AM) - Overdue leads
7. **Inventory Valuation** (Daily, 1:00 AM) - MTM revaluation
8. **LTV Recalculation** (Daily, 6:00 AM) - Update all loan LTVs
9. **Interest Accrual** (Daily, 2:00 AM) - Accrue loan interest
10. **Margin Call Checks** (Every 4 hours) - Check LTV breaches
11. **Loan Reminders** (Daily, 9:30 AM) - Maturity/payment reminders

#### BackupService (13 methods)
Enterprise-grade backup system:
- Full database dumps with pg_dump
- Partial backups (specific tables)
- Gzip compression
- S3/MinIO cloud upload with retry logic
- Backup verification with table count validation
- Automated cleanup (30-day retention)
- Health checks (database connectivity, table counts)
- Monitoring dashboard data

**Backup Filename Format:**
```
backup_YYYYMMDD_HHmmss.sql.gz
Example: backup_20260209_020000.sql.gz
```

---

## Frontend Application

The frontend consists of **84+ pages** across **15+ major modules**, built with Next.js 14 App Router.

### Navigation Structure

The sidebar navigation (15 sections):

1. **Dashboard** - Overview metrics and quick actions
2. **Inventory** - View Inventory, Batches, Categories
3. **Sales & POS** - Invoicing, gold rates
4. **Customers** - All Customers, Loyalty Rewards
5. **Leads** - Lead management
6. **Gold Pawning** - Dashboard, New Loan, KYC, Margin Calls, Auctions, Interest Rates
7. **Accounting** - Overview, Chart of Accounts, Journal Entries, Expenses, Reports
8. **Suppliers** - Supplier management
9. **Reports** - Overview, Margin Analysis, Stock Aging, Salesperson
10. **Custom Orders** - Order management
11. **Repairs** - Repair workflow
12. **Metal Position** - Multi-store metal inventory
13. **Karigars** - All Karigars, Job Cards, Scrap Inventory, Melting Records
14. **HRM** - Overview, Employees, Attendance, Leave Management, Payroll
15. **Command Center** - Overview, Financial Dashboard, Gold Loans, Orders & Repairs, Customers, Activity Feed
16. **Settings** - Stores, Label Designer

### Frontend Architecture Patterns

#### 1. API Client (`lib/api-client.ts`)
Centralized Axios instance with:
- Base URL configuration
- JWT token handling (cookies)
- Request/response interceptors
- Error handling with toast notifications
- TypeScript response types

#### 2. State Management (`store/auth-store.ts`)
Zustand store for:
- Current user state
- Store selection
- Login/logout actions
- Persistent storage with localStorage

#### 3. Component Library
shadcn/ui components:
- `Button`, `Input`, `Label`, `Select`
- `Card`, `Badge`, `Separator`, `Sheet`
- `Dialog`, `Toast`, `Progress`
- `Table` (with TanStack Table)
- All built on Radix UI primitives

#### 4. Utility Functions

**Currency Formatting (`lib/currency.ts`):**
```typescript
formatCurrency(123456.78) → "₹1,23,456.78"
```

**Weight Utilities (`lib/weight-utils.ts`):**
```typescript
formatWeight(15.567) → "15.57 g"
convertToFineGold(15.0, "22K") → 13.75 grams
```

**Zebra ZPL Generation (`lib/zebra-zpl.ts`):**
Generates ZPL code for thermal label printers:
- Barcodes (Code 128)
- Text fields with positioning
- Company logo/header
- Box borders

#### 5. Middleware (`middleware.ts`)
Next.js middleware for:
- Authentication checks
- Store access validation
- Redirect to login if unauthenticated
- Protected routes enforcement

### Page Organization

Pages follow a consistent structure:
```typescript
'use client'; // Client component

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Input } from '@/components/ui';
import { apiClient } from '@/lib/api-client';

export default function PageName() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await apiClient.get('/endpoint');
      setData(response.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Page Title</h1>
      {/* Content */}
    </div>
  );
}
```

### Key UI Features

#### 1. Dashboard Pages
- Statistics cards with icons (Lucide React)
- Chart visualizations (Recharts: Area, Bar, Pie, Line)
- Quick action buttons
- Real-time data updates
- PDF export functionality (jsPDF)

#### 2. Data Tables
- Sortable columns (TanStack Table)
- Pagination controls
- Search and filter
- Row actions (view, edit, delete)
- Bulk actions
- Status badges with color coding

#### 3. Forms
- React Hook Form integration
- Zod schema validation
- Inline error messages
- Loading states
- Success/error toasts (Sonner)
- Multi-step forms with progress indicators

#### 4. Modal Workflows
- Dialog-based quick actions
- Confirmation dialogs
- Detail views in sheets/modals
- Drawer navigation for mobile

#### 5. Label Designer
Custom visual designer for label templates:
- Drag-and-drop field positioning
- Real-time preview
- Template dimensions configuration
- Company header customization
- Border and background styling
- Save and preview functionality

#### 6. Print Functionality
- React-to-Print integration
- PDF export for invoices, reports
- ZPL generation for thermal printers
- Batch label printing
- USB printer support

---

## Authentication & Authorization

### Authentication Flow

1. **Registration** (`POST /api/v1/auth/register`)
   - Email, password, name, phone
   - Password hashing with bcrypt (10 rounds)
   - Default role assignment
   - Store association

2. **Login** (`POST /api/v1/auth/login`)
   - Email + password validation
   - JWT token generation (7-day expiry)
   - Refresh token (30-day expiry)
   - HTTP-only cookie storage
   - Session creation in database

3. **Token Refresh** (`POST /api/v1/auth/refresh`)
   - Refresh token validation
   - New access token issuance
   - Session extension

4. **Logout** (`POST /api/v1/auth/logout`)
   - Session deletion
   - Cookie clearing
   - Token invalidation

5. **Profile** (`GET /api/v1/auth/me`)
   - Current user info
   - Assigned roles and stores
   - Permission aggregation

### Authorization Model

#### Resource-Action Permission Model

**33+ Resources:**
```
inventory, sales, customers, accounting, suppliers,
gold_loans, custom_orders, repairs, reports, users,
stores, settings, employees, attendance, leave, payroll,
command_center, branches, karigars, job_cards, scrap,
melting, loan_config, loan_kyc, loan_auctions,
loan_documents, margin_calls, backups
```

**14+ Actions:**
```
create, read, update, delete, approve, export,
mark_own, request_own, pay, aggregate, verify,
initiate_auction, waive, disburse, renew
```

**Permission Format:** `resource:action`
- Example: `inventory:create`, `sales:read`, `gold_loans:approve`

#### 7 Roles with Hierarchy

| Level | Role | Description |
|-------|------|-------------|
| 7 | `super_admin` | Full system access, multi-store management |
| 6 | `owner` | Store owner, full financial and operational access |
| 5 | `store_manager` | Store operations, inventory, sales, HR |
| 4 | `accountant` | Financial records, accounting, reports |
| 3 | `salesperson` | Sales, customers, inventory view, commissions |
| 2 | `cashier` | POS operations, payments, basic inventory |
| 1 | `employee` | Limited access (attendance, own leave, basic views) |

#### Permission Sets

**Employee HRM Permissions:**
```typescript
EMPLOYEE_HRM = [
  'attendance:mark_own',
  'leave:request_own',
  'payroll:read' (own only),
]
```

**Manager HRM Permissions:**
```typescript
MANAGER_HRM = [
  'employees:read',
  'attendance:read', 'attendance:update',
  'leave:read', 'leave:approve',
]
```

**Full HRM Permissions:**
```typescript
FULL_HRM = [
  'employees:*', 'attendance:*', 'leave:*',
  'payroll:*', 'advances:*'
]
```

**Loan Officer Permissions:**
```typescript
LOAN_OFFICER = [
  'gold_loans:create', 'gold_loans:read',
  'loan_kyc:verify', 'loan_documents:read',
]
```

**Loan Manager Permissions:**
```typescript
LOAN_MANAGER = [
  'gold_loans:*', 'loan_config:*', 'loan_kyc:*',
  'margin_calls:*', 'loan_auctions:initiate_auction',
]
```

### Middleware Implementation

#### 1. Authentication Middleware (`auth.middleware.ts`)
```typescript
export const authenticate = async (req, res, next) => {
  // Extract JWT from cookie
  const token = req.cookies.token;

  // Verify token
  const decoded = jwt.verify(token, JWT_SECRET);

  // Load user with roles
  const user = await db.query.users.findFirst({
    where: eq(users.id, decoded.userId),
    with: {
      userRoles: {
        with: { role: true, store: true }
      }
    }
  });

  // Attach to request
  req.user = user;
  req.userId = user.id;

  next();
};
```

#### 2. RBAC Middleware (`rbac.middleware.ts`)
```typescript
export const requirePermission = (resource, action) => {
  return async (req, res, next) => {
    const { user } = req;

    // Get user permissions from roles
    const permissions = await getUserPermissions(user.id);

    // Check if user has permission
    const hasPermission = permissions.some(
      p => p.resource === resource && p.action === action
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' }
      });
    }

    next();
  };
};
```

#### 3. Store Access Middleware (`store-access.middleware.ts`)
```typescript
export const requireStoreAccess = async (req, res, next) => {
  const { storeId } = req.params;
  const { user } = req;

  // Super admin has access to all stores
  if (user.roles.some(r => r.name === 'super_admin')) {
    return next();
  }

  // Check if user has role in this store
  const hasAccess = user.userRoles.some(
    ur => ur.storeId === storeId
  );

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'No access to this store' }
    });
  }

  next();
};
```

---

## Scheduled Jobs & Automation

The system runs **11+ background jobs** via node-cron, all managed by `SchedulerService`.

### Job Schedule

| Job Name | Schedule | Description | Service Method |
|----------|----------|-------------|----------------|
| **Daily Briefing** | `0 8 * * *` (8:00 AM daily) | Sends email summary to all store users | `dailyBriefingService.sendDailyBriefing()` |
| **Pending Email Processor** | `*/5 * * * *` (Every 5 minutes) | Processes scheduled email queue | `emailService.processPendingEmails()` |
| **Log Cleanup** | `0 2 1 * *` (1st of month, 2:00 AM) | Deletes logs older than 90 days | `cleanupOldLogs()` |
| **Wishlist Expiration** | `0 0 * * *` (Midnight daily) | Marks expired wishlists | `wishlistService.expireOldWishlists()` |
| **Buying Habits Recalculation** | `0 3 * * 0` (Sunday 3:00 AM) | Recalculates RFM scores for all customers | `buyingHabitsService.recalculateAllHabits()` |
| **Lead Follow-up Reminders** | `0 9 * * *` (9:00 AM daily) | Identifies overdue lead follow-ups | `leadService.getLeadsNeedingFollowUp()` |
| **Inventory Valuation** | `0 1 * * *` (1:00 AM daily) | Revalues inventory based on gold rates | `stockValuationService.revalueAllStores()` |
| **LTV Recalculation** | `0 6 * * *` (6:00 AM daily) | Recalculates LTV for all active loans | `goldPawningService.recalculateLoanLTV()` |
| **Interest Accrual** | `0 2 * * *` (2:00 AM daily) | Accrues daily interest for all loans | `goldPawningService.accrueInterestForAllLoans()` |
| **Margin Call Checks** | `0 */4 * * *` (Every 4 hours) | Checks for LTV breaches | `goldPawningService.checkMarginCalls()` |
| **Loan Reminders** | `30 9 * * *` (9:30 AM daily) | Sends maturity/payment reminders | `loanNotificationService.sendBulkReminders()` |

### Manual Triggers

The scheduler service exposes manual trigger methods:

```typescript
// Trigger daily briefing for a store
await schedulerService.triggerDailyBriefing(storeId);

// Trigger buying habits recalculation
await schedulerService.triggerBuyingHabitsRecalculation();

// Trigger inventory valuation for a store
await schedulerService.triggerInventoryValuation(storeId);

// Trigger valuation across all stores
await schedulerService.triggerAllStoresValuation();
```

These can be called from:
- API endpoints (`/api/v1/reports/trigger-revaluation`)
- Admin dashboard
- CLI scripts

### Job Status Monitoring

Get the status of all scheduled jobs:

```typescript
const status = schedulerService.getStatus();
```

Returns:
```json
{
  "dailyBriefing": { "scheduled": true, "lastRun": "2026-02-09T08:00:00Z" },
  "emailProcessor": { "scheduled": true, "lastRun": "2026-02-09T10:25:00Z" },
  "logCleanup": { "scheduled": true, "lastRun": "2026-02-01T02:00:00Z" },
  // ... all other jobs
}
```

---

## Key Business Features

### 1. Fine Gold Accounting

**Problem:** Jewellery comes in different purities (24K, 22K, 18K, 916, 750). Direct weight comparison is meaningless.

**Solution:** All gold is normalized to **fine gold equivalent (24K basis)**.

**Implementation:**
- `inventoryItems.fineGoldEquivalent` - Calculated from netWeight × purityFactor
- `supplierAccountTransactions.fineGoldGrams` - Gold transactions in 24K
- `pledgedGold.fineGoldEquivalent` - Loan collateral in 24K
- `metalAccountingService` - Central conversion logic

**Metal Position Report:**
```
Store A Metal Position (as of 2026-02-09):

  Inventory:
    24K: 145.67 g
    22K: 1,234.56 g (1,131.85 g fine)
    18K: 567.89 g (425.92 g fine)
    Total Inventory: 1,703.44 g fine gold

  Gold with Karigars: 234.56 g fine gold
  Gold Owed to Suppliers: -89.23 g fine gold
  Gold in Loans (Pledged): 456.78 g fine gold

  Net Position: 2,305.55 g fine gold
  Market Value: ₹14,534,625 (at ₹6,300/g)
```

### 2. RBI LTV Compliance (Gold Loans)

**Reserve Bank of India Guidelines:**
- Loans ≤ ₹2,50,000: Maximum 85% LTV
- Loans ₹2,50,001 - ₹5,00,000: Maximum 80% LTV
- Loans > ₹5,00,000: Maximum 75% LTV

**Implementation:**
- `goldPawningService.getRbiMaxLtv(amount)` - Returns max allowed LTV
- `goldPawningService.validateLTV(loanAmount, collateralValue)` - Pre-loan validation
- `goldPawningService.recalculateLoanLTV(loanId)` - Daily recalculation based on gold rate changes
- `loanLtvHistory` table - Audit trail of LTV changes
- `marginCalls` table - Automatic breach notifications

**Margin Call Workflow:**
1. Daily LTV recalculation job (6:00 AM)
2. If LTV exceeds max → Create margin call
3. Margin call requires either:
   - Additional collateral (gold)
   - Partial loan repayment
   - Full loan settlement
4. Compliance deadline (typically 7-14 days)
5. If non-compliant → Initiate auction

### 3. Dual-Ledger Supplier Accounting

**Problem:** Suppliers transactions can be:
- Monetary (cash/bank payments)
- Gold-based (gold received/returned)
- Gold exchange (business gives gold to supplier for manufacturing, supplier returns finished goods)

**Solution:** Maintain **three separate balances**:

**Suppliers Table:**
```sql
currentBalance: Monetary balance (₹)
totalPurchases: Total ₹ purchases
totalPaid: Total ₹ paid

goldBalanceGrams: Net gold balance (24K)
totalGoldReceived: Gold received from supplier
totalGoldReturned: Gold returned to supplier

goldExchangeBalanceGrams: Gold exchange balance
  Positive: Supplier owes business gold
  Negative: Business owes supplier gold
```

**Transaction Types:**
- `purchase`: Monetary purchase (increases currentBalance)
- `payment`: Payment to supplier (decreases currentBalance)
- `gold_received`: Gold received (increases goldBalanceGrams)
- `gold_returned`: Gold returned to supplier (decreases goldBalanceGrams)
- `gold_exchange`: Gold given for manufacturing (tracks exchange balance)
- `gold_settled`: Settlement of exchange balance

**Unified Ledger API:**
```
GET /api/v1/suppliers/:id/unified-ledger
```

Returns combined monetary + gold transactions in chronological order with running balances.

### 4. RFM Customer Segmentation

**RFM Analysis:** Segments customers based on:
- **R**ecency: How recently did they purchase?
- **F**requency: How often do they purchase?
- **M**onetary: How much do they spend?

**Segments:**
1. **Champions** (R=5, F=5, M=5): Best customers, buy frequently, spend most
2. **Loyal Customers** (R=4-5, F=4-5, M=3-5): Regular buyers, consistent spend
3. **Potential Loyalist** (R=4-5, F=2-3, M=3-4): Recent buyers, good potential
4. **At Risk** (R=2-3, F=3-5, M=3-5): Used to buy frequently, now declining
5. **Can't Lose Them** (R=1-2, F=4-5, M=4-5): High-value customers, haven't bought recently
6. **Hibernating** (R=1-2, F=2-3, M=2-3): Low activity, might be lost
7. **Lost** (R=1-2, F=1-2, M=1-2): Lowest engagement
8. **Promising** (R=4-5, F=1, M=1-2): New customers with potential
9. **Need Attention** (R=3-4, F=2-3, M=2-3): Average customers, need engagement
10. **About to Sleep** (R=2-3, F=1-2, M=1-2): Declining engagement

**Churn Risk Score (0-100):**
```typescript
churnRisk = (
  (100 - recencyScore * 20) * 0.4 +  // 40% weight on recency
  (100 - frequencyScore * 20) * 0.3 + // 30% weight on frequency
  (100 - monetaryScore * 20) * 0.3    // 30% weight on monetary
)
```

**Usage:**
- Targeted marketing campaigns
- Retention strategies for "At Risk" customers
- VIP treatment for "Champions"
- Re-engagement campaigns for "Hibernating"

### 5. Commission Tracking

**Multi-Tier Commission Structure:**

**Commission Rates Table:**
```sql
storeId: Store assignment
category: Optional (rings, necklaces, etc.)
metalType: Optional (gold, silver, diamond)
amountMin / amountMax: Optional amount brackets
rateType: 'percentage' | 'fixed'
rateValue: Commission percentage or fixed amount
isActive: Active/inactive
```

**Commission Calculation Logic:**
1. Find most specific rate (category + metalType > category > metalType > default)
2. Check amount bracket eligibility
3. Apply rate to invoice item
4. Record in `commissionLedger` with running balance

**Commission Ledger:**
```sql
salespersonId
transactionType: 'earned' | 'paid' | 'adjustment'
amount: Commission amount
runningBalance: Current balance
invoiceId: Reference to sale (if earned)
```

**Monthly Summary:**
- Total sales value
- Total commission earned
- Total commission paid
- Average commission rate
- Sales count
- Top categories sold

**Reports:**
- Salesperson performance ranking
- Commission vs. sales trend
- Category-wise commission analysis
- Unpaid commission summary

### 6. Mark-to-Market Inventory Valuation

**Problem:** Gold prices fluctuate daily. Purchase cost becomes outdated.

**Solution:** Nightly revaluation based on current gold rates.

**Implementation:**

**Inventory Items:**
```sql
totalCost: Original purchase cost (historical)
lastValuationDate: Last revaluation date
currentMarketValue: Current market value based on gold rate
unrealizedGainLoss: currentMarketValue - totalCost
```

**Revaluation Job (1:00 AM daily):**
```typescript
For each item:
  1. Get current gold rate for item's purity
  2. Calculate current metal value = netWeight × currentRate
  3. Add making charges
  4. currentMarketValue = metal value + making charges
  5. unrealizedGainLoss = currentMarketValue - totalCost
  6. Update lastValuationDate
```

**Stock Aging Report:**
```
Age Bucket | Items | Total Cost | Current Value | Gain/Loss | %
0-30 days  |   145 | ₹23,45,000 |  ₹24,12,000  | +₹67,000  | +2.9%
31-60 days |    89 | ₹15,67,000 |  ₹16,34,000  | +₹67,000  | +4.3%
61-90 days |    45 | ₹8,90,000  |  ₹9,12,000   | +₹22,000  | +2.5%
91-180 days|    23 | ₹5,67,000  |  ₹5,45,000   | -₹22,000  | -3.9%
181-365 days|  12 | ₹3,45,000  |  ₹3,12,000   | -₹33,000  | -9.6%
365+ days  |     5 | ₹1,23,000  |  ₹89,000     | -₹34,000  | -27.6%
```

**Dead Stock:** Items older than 365 days with negative unrealized gain/loss.

### 7. ROI & Margin Analysis

**Item-Level ROI Tracking (Invoice Items):**

```sql
metalCostAtSale: Gold rate at time of sale (per gram)
metalMarginGrams: Fine gold margin = (saleRate - purchaseRate) × netWeight
holdingPeriodDays: Days from purchase to sale
effectiveROI: Annualized return on investment
grossMargin: Total profit including making charges
```

**ROI Calculation:**
```typescript
const purchaseCost = item.totalCost; // From batch
const salePrice = invoiceItem.finalAmount; // From invoice
const profit = salePrice - purchaseCost;
const profitPercentage = (profit / purchaseCost) * 100;
const holdingDays = daysBetween(item.purchasedAt, invoice.createdAt);
const effectiveROI = (profitPercentage / holdingDays) * 365; // Annualized
```

**Margin Analysis Report:**
- Item-wise profit margins
- Category-wise average margins
- Metal-wise margins (gold vs. silver vs. diamond)
- Top/bottom performers by ROI
- Holding period vs. margin correlation

**Metal Profit/Loss Report:**
- Metal rate spread (purchase vs. sale)
- Volume of metal traded (fine gold)
- Profit from metal trading
- Profit from making charges
- Total gross margin

### 8. Job Card Manufacturing Workflow

**Workflow:**
```
1. Create Job Card
   - Assign to karigar
   - Issue gold (metalIssuedGrams, purity)
   - Set expected finished weight
   - Set wastage allowance (%)

2. Karigar Works
   - Gold given to karigar
   - Karigar works on items
   - Gold balance credited to karigar

3. Return Goods
   - Finished goods weight recorded
   - Scrap returned (if any)
   - Actual wastage calculated

4. Settle Job Card
   - Calculate labour charges
   - Adjust karigar gold balance
   - Adjust karigar cash balance (labour owed)
   - Create scrap inventory records
   - Update job card status: 'settled'
```

**Wastage Tracking:**
```typescript
const metalIssued = 100.00 grams (22K)
const finishedWeight = 92.50 grams (22K)
const scrapReturned = 5.00 grams (22K)
const totalReturned = finishedWeight + scrapReturned = 97.50 grams
const actualWastage = metalIssued - totalReturned = 2.50 grams
const wastagePercentage = (actualWastage / metalIssued) * 100 = 2.5%
```

**Labour Charges:**
- Base rate per gram (from `karigars.labourRatePerGram`)
- Can be overridden on job card
- Charges = finishedWeight × labourRate

**Karigar Ledger:**
```sql
transactionType:
  - 'gold_issued': Gold given for job
  - 'gold_returned': Finished goods returned
  - 'labour_charge': Labour owed to karigar
  - 'payment': Cash paid to karigar
  - 'advance': Advance given

goldBalance: Running gold balance
cashBalance: Running cash balance (labour owed)
```

---

## Module-by-Module Breakdown

### 1. Inventory Module

**Database Tables:** 7
**API Endpoints:** 26
**Frontend Pages:** 13
**Services:** MetalAccountingService, StockValuationService, CostingService

**Key Features:**
- **Batch Management:** Create batches with supplier, purchase type (monetary/gold exchange)
- **Item Management:** Add items to batches with detailed specifications
- **Stock Transfers:** Seamless inventory transfer between stores with approval workflow
- **Categories:** Hierarchical category structure with dimension requirements
- **Label Designer:** Custom label templates with visual designer
- **Label Printing:** Enhanced ZPL generation for thermal printers, batch printing, and sharp barcode rendering
- **Valuation:** Mark-to-market inventory valuation with unrealized gain/loss
- **Aging Reports:** Stock aging buckets, dead stock identification
- **Turnover Analysis:** Inventory turnover ratios, slow-moving items
- **Search & Filter:** Advanced search by category, metal type, purity, status
- **Image Management:** Multiple images per item with gallery view

**Batch Workflow:**
```
1. Create Batch
   - Select supplier
   - Choose purchase type (monetary/gold_exchange)
   - Set expected items/weight
   - Configure payment terms

2. Add Items
   - Enter item details (metal, weight, purity, dimensions)
   - Upload images
   - Calculate costs (per gram, making charges, GST)
   - Track stones/diamonds

3. Generate Labels
   - Select items for labeling
   - Preview labels
   - Print to thermal printer

4. Complete Batch
   - Verify items added
   - Create stock movements
   - Update supplier balance (monetary or gold)
   - Generate batch summary

5. Record Payments
   - Track payments against batch
   - Update supplier account
   - Handle partial payments
```

**Costing Methods:**
- **FIFO** (First-In-First-Out): Oldest cost used first
- **LIFO** (Last-In-First-Out): Newest cost used first
- **Weighted Average:** Average cost across all layers
- **Specific Identification:** Exact item tracking with batch reference

### 2. Sales Module

**Database Tables:** 5
**API Endpoints:** 10
**Frontend Pages:** 5
**Services:** CommissionService, MarginReportsService

**Key Features:**
- **Gold Rate Management:** Daily gold rates by purity
- **Invoice Creation:** Multi-item invoicing with customer selection
- **Payment Tracking:** Multiple payment methods (cash, card, UPI, bank transfer)
- **Sales Returns:** Full return workflow with refund/credit management and stock adjustment
- **Quotations:** Price quotes without finalizing sale
- **Loyalty Integration:** Automatic loyalty points calculation
- **Commission Tracking:** Salesperson commission calculation
- **ROI Metrics:** Item-level ROI and margin tracking on invoice items
- **GST Calculation:** Automatic GST calculation based on item tax rates
- **Invoice PDF:** Generate printable invoices
- **Payment Status:** Paid, partial, pending with visual indicators

**Invoice Workflow:**
```
1. Select Customer
   - Search existing customer
   - Create new customer inline
   - Apply loyalty tier discounts

2. Add Items
   - Search inventory items
   - Select items to sell
   - Adjust quantities (for raw materials)
   - Apply discounts

3. Calculate Totals
   - Subtotal
   - Discount
   - GST
   - Grand total

4. Record Payment
   - Payment method
   - Amount received
   - Change to return

5. Finalize Invoice
   - Mark items as sold
   - Create invoice record
   - Award loyalty points
   - Calculate commission
   - Update stock levels
   - Generate invoice PDF
```

### 3. Customer Module

**Database Tables:** 13
**API Endpoints:** 23
**Frontend Pages:** 7
**Services:** LoyaltyService, ReferralService, WishlistService, BuyingHabitsService, LeadService, WhatsAppService

**Key Features:**
- **Customer Management:** Complete customer profiles with multiple addresses
- **Loyalty Program:** 4-tier system (Bronze, Silver, Gold, Platinum)
- **Points System:** Earn on purchases, redeem for rewards
- **Rewards Catalog:** Service, discount, and product rewards
- **Referral Program:** Refer-a-friend with reward tracking
- **Wishlist:** Item-specific or custom criteria wishlists
- **Buying Habits:** RFM analysis, churn prediction, budget tiers
- **Purchase History:** Complete transaction history
- **WhatsApp Integration:** Message history, automated notifications
- **Customer Analytics:** Tier distribution, top customers, retention metrics

**Loyalty Tiers:**
```
Bronze (0-4,999 points):
  - Base earning: 1 point per ₹100
  - Welcome bonus: 100 points
  - Referral reward: 200 points

Silver (5,000-14,999 points):
  - Earning: 1.25 points per ₹100
  - Birthday bonus: 2x points
  - Tier upgrade bonus: 500 points

Gold (15,000-29,999 points):
  - Earning: 1.5 points per ₹100
  - Birthday/anniversary bonus: 3x points
  - Tier upgrade bonus: 1,000 points
  - Priority service

Platinum (30,000+ points):
  - Earning: 2 points per ₹100
  - Birthday/anniversary bonus: 5x points
  - Tier upgrade bonus: 2,000 points
  - Exclusive rewards access
  - Personal shopper
```

**Referral Rewards:**
- Referrer: 500 points when referred customer makes first purchase ≥ ₹10,000
- Referred: 100 points welcome bonus
- Tier bonuses: Silver (1,000), Gold (2,500), Platinum (5,000) for milestone referrals

### 4. Gold Pawning Module

**Database Tables:** 13
**API Endpoints:** 32 (pawning) + 8 (loans)
**Frontend Pages:** 7
**Services:** GoldPawningService, KycService, LoanNotificationService

**Key Features:**
- **Loan Management:** Create, approve, disburse, payments, releases
- **Interest Rates:** Tiered rates based on loan amount and tenure
- **LTV Tracking:** Daily LTV recalculation with history
- **RBI Compliance:** Automatic LTV limits based on loan amount
- **KYC Verification:** Aadhaar and PAN document management
- **Margin Calls:** Automatic breach detection and notifications
- **Loan Renewals:** Extend loans with revaluation
- **Auctions:** Foreclosure auction workflow
- **Interest Accrual:** Daily interest calculation with penalties
- **Notifications:** SMS/WhatsApp reminders for maturity, payments, margin calls
- **Dashboard:** Portfolio overview, overdue loans, LTV alerts

**Loan Lifecycle:**
```
1. KYC Verification
   - Collect Aadhaar + PAN
   - Verify documents
   - Record in customerKyc table

2. Create Loan
   - Select customer (must have KYC)
   - Add pledged gold items (weight, purity)
   - Calculate collateral value (gold rate × fine gold)
   - Enter loan amount
   - Validate LTV (must be ≤ RBI max)
   - Set interest rate (from configuration)
   - Set tenure and maturity date

3. Approve Loan
   - Review details
   - Mark status: 'approved'
   - Generate loan agreement

4. Disburse Loan
   - Create payment record
   - Mark status: 'active'
   - Start interest accrual

5. Interest Accrual (Daily at 2 AM)
   - Calculate daily interest
   - Add to outstanding balance
   - Check for penalty (if overdue)

6. LTV Monitoring (Daily at 6 AM)
   - Get current gold rate
   - Recalculate collateral value
   - Calculate current LTV
   - Store in loanLtvHistory
   - If LTV > max → Create margin call

7. Margin Call Response
   - Customer adds collateral (more gold), OR
   - Customer makes partial repayment, OR
   - Customer settles loan fully
   - Record compliance
   - Close margin call

8. Loan Repayment
   - Accept payment (principal + interest)
   - Update outstanding balance
   - Create loanPayment record

9. Loan Release (Closure)
   - Full repayment confirmed
   - Return pledged gold to customer
   - Create loanRelease record
   - Mark status: 'closed'

10. Auction (if defaulted)
    - Initiate auction after grace period
    - Set reserve price
    - Conduct auction
    - Record sale details
    - Settle loan from proceeds
    - Refund surplus to customer (if any)
```

**Interest Calculation:**
```typescript
// Example: ₹1,00,000 loan at 12% annual, 30 days overdue
const principal = 100000;
const annualRate = 12; // 12%
const dailyRate = annualRate / 365 = 0.0329%;
const daysOverdue = 30;
const penaltyRate = 18; // 18% annual
const dailyPenaltyRate = penaltyRate / 365 = 0.0493%;

// Regular interest
const regularInterest = principal × (dailyRate / 100) × daysOverdue
                       = 100000 × 0.000329 × 30
                       = ₹987

// Penalty interest
const penaltyInterest = principal × (dailyPenaltyRate / 100) × daysOverdue
                      = 100000 × 0.000493 × 30
                      = ₹1,479

// Total interest owed
const totalInterest = regularInterest + penaltyInterest
                    = ₹2,466
```

### 5. Accounting Module

**Database Tables:** 7
**API Endpoints:** 18
**Frontend Pages:** 5
**Services:** None (uses Drizzle queries directly)

**Key Features:**
- **Chart of Accounts:** Hierarchical account structure (5 types: Asset, Liability, Equity, Income, Expense)
- **Journal Entries:** Double-entry bookkeeping with debit/credit lines
- **Bank Accounts:** Multi-bank account management
- **Expenses:** Expense tracking with GST, vendor, and category
- **Cash Register:** Daily cash register opening/closing
- **Reports:** Income statement, balance sheet
- **Financial Periods:** Monthly/yearly period management
- **Triple-Entry Bookkeeping:** Currency + Weight + Fine Gold tracking

**Account Types:**
```
Assets:
  - Current Assets (Cash, Bank, Accounts Receivable, Inventory)
  - Fixed Assets (Property, Equipment, Furniture)

Liabilities:
  - Current Liabilities (Accounts Payable, Short-term Loans)
  - Long-term Liabilities (Long-term Loans, Mortgages)

Equity:
  - Owner's Equity
  - Retained Earnings
  - Current Year Profit/Loss

Income:
  - Sales Revenue
  - Interest Income
  - Other Income

Expenses:
  - Cost of Goods Sold
  - Operating Expenses
  - Interest Expense
  - Administrative Expenses
```

**Journal Entry Example:**
```
Date: 2026-02-09
Type: sales
Reference: INV-2026-001
Narration: Sale of 22K gold necklace to customer

Lines:
  DR Bank Account          ₹50,000
  CR Sales Revenue                    ₹47,619
  CR GST Payable                      ₹2,381

  DR COGS                  ₹35,000
  CR Inventory                        ₹35,000
```

### 6. HRM Module

**Database Tables:** 7
**API Endpoints:** 28
**Frontend Pages:** 9
**Services:** None

**Key Features:**
- **Employee Management:** Complete employee profiles with salary info and NIC/Photo attachments
- **Employment Status:** Track probation vs permanent status
- **Attendance:** Daily check-in/check-out, overtime tracking
- **Leave Management:** Leave types, requests, approvals, balance tracking
- **Payroll:** Monthly and Weekly payroll generation with deductions and allowances
- **Festive Bonuses:** Automated bonus calculation for Thaipongal, New Year, Deepavali, Christmas
- **Salary Advances:** Advance request and approval workflow
- **Reports:** Attendance reports, payroll summaries

**Attendance Workflow:**
```
1. Mark Attendance
   - Check-in time
   - Check-out time
   - Attendance status (present, absent, half_day, leave)
   - Late arrival tracking
   - Early departure tracking

2. Calculate Work Hours
   - Work hours = check-out - check-in
   - If work hours < 4 → half_day
   - If work hours > 9 → overtime hours

3. Monthly Summary
   - Present days
   - Absent days
   - Leave days
   - Half days
   - Total work hours
   - Overtime hours
```

**Payroll Workflow:**
```
1. Generate Monthly Payroll (1st of month)
   - For each employee:
     - Base salary (from employees table)
     - Days worked (from attendance)
     - Overtime hours and amount
     - Allowances (transport, meal, etc.)
     - Bonuses
     - Deductions (advance, tax, PF, ESI)
     - Net salary = base + allowances + bonuses + overtime - deductions

2. Approve Payroll
   - Review generated records
   - Approve for payment

3. Process Payment
   - Mark payroll as 'paid'
   - Create payment records
   - Update employee salary advance balances
   - Generate payslips
```

### 7. Karigar & Manufacturing Module

**Database Tables:** 6 (karigars: 3, scrap: 3)
**API Endpoints:** 13 (karigars: 7, job-cards: 6, scrap: 7)
**Frontend Pages:** 8
**Services:** None

**Key Features:**
- **Karigar Management:** Artisan profiles with specialization and rates
- **Job Cards:** Manufacturing job tracking with gold issuance/return
- **Scrap Management:** Accumulated scrap inventory
- **Melting Records:** Scrap melting and refining tracking
- **Wastage Tracking:** Expected vs. actual wastage calculation
- **Labour Charges:** Per-gram or per-job labour costing
- **Dual Ledger:** Gold balance + cash balance for each karigar

**Job Card Workflow:**
```
1. Create Job Card
   - Select karigar
   - Link to custom order (optional)
   - Issue gold: weight + purity
   - Set expected finished weight
   - Set wastage allowance (e.g., 3%)
   - Add notes for karigar

2. Gold Transfer
   - Deduct gold from business inventory
   - Credit karigar gold balance
   - Record transaction: 'gold_issued'
   - Job card status: 'issued'

3. Karigar Works
   - Transform raw gold into finished product
   - Generate scrap in process

4. Return Goods
   - Record finished goods weight
   - Record scrap returned
   - Calculate actual wastage
   - Job card status: 'returned'
   - Create karigar transaction: 'gold_returned'

5. Settle Job Card
   - Calculate labour charges
   - Deduct finished gold from karigar balance
   - Add finished goods to inventory
   - Credit labour charges to karigar cash balance
   - Create scrap inventory records
   - Job card status: 'settled'

Example:
  Gold Issued: 100.00 g (22K)
  Expected Finished: 97.00 g (3% wastage allowance)
  Actual Finished: 92.50 g
  Scrap Returned: 5.00 g
  Total Returned: 97.50 g
  Actual Wastage: 2.50 g (2.5% - within allowance)
  Labour Charge: 92.50 g × ₹150/g = ₹13,875
```

**Scrap to Melting Workflow:**
```
1. Accumulate Scrap
   - From repairs: damaged items, filing waste
   - From manufacturing: job card scrap
   - From exchanges: old jewellery
   - From returns: defective items

2. Create Melting Record
   - Select scrap items to melt
   - Total input weight (mixed purities)
   - Estimated average purity
   - Select refiner (external or internal)

3. Send for Melting
   - Physical transfer to refiner
   - Record melting cost (if external)

4. Receive Refined Gold
   - Output weight (should be less due to loss)
   - Output purity (usually 99.9% or 24K)
   - Calculate recovery percentage
   - Update scrap status: 'melted'
   - Add refined gold to inventory

Example:
  Input Scrap: 150.00 g mixed (avg purity 85%)
  Fine Gold Input: 150 × 0.85 = 127.50 g fine
  Output: 122.00 g at 99.9% purity
  Fine Gold Output: 122 × 0.999 = 121.88 g fine
  Recovery: 121.88 / 127.50 = 95.6%
  Loss: 4.4% (acceptable range: 3-6%)
```

### 8. Reports Module

**Database Tables:** 5 (dailySummaries, reportSnapshots, categoryPerformance, metalProfitLoss, stockAgingSnapshots)
**API Endpoints:** 15
**Frontend Pages:** 4
**Services:** DailySummaryService, MarginReportsService, StockValuationService

**Key Features:**
- **Dashboard Metrics:** Real-time KPIs (today, week, month)
- **Margin Analysis:** Item-level profit margins, ROI ranking
- **Category Performance:** Sales, margin, and inventory by category
- **Salesperson Performance:** Sales value, commission, margins by salesperson
- **Metal Profit/Loss:** Metal trading profitability analysis
- **ROI Ranking:** Best and worst performing items by ROI
- **Stock Aging:** Aging bucket analysis with unrealized gain/loss
- **Slow-Moving Items:** Items with low turnover
- **Valuation Summary:** Current inventory valuation vs. cost
- **Daily Summaries:** Historical daily aggregated data

**Dashboard Metrics (Today/Week/Month):**
```
Sales:
  - Total revenue
  - Invoice count
  - Average invoice value
  - Customer count
  - Gross margin

Inventory:
  - Total value (cost basis)
  - Current market value
  - Unrealized gain/loss
  - Items added
  - Batches completed

Financial:
  - Cash in hand
  - Bank balance
  - Accounts receivable
  - Accounts payable
  - Net liquidity

Loans:
  - Active loans count
  - Total disbursed
  - Outstanding principal
  - Interest collected
  - Overdue loans

Customers:
  - New customers
  - Loyalty points issued
  - Rewards redeemed
  - Churn risk customers
```

**Margin Analysis Report:**
```
Item | Category | Cost | Sale Price | Margin | ROI | Holding Days
-----|----------|------|------------|--------|-----|-------------
NK-001 | Necklaces | ₹45,000 | ₹58,500 | ₹13,500 (30%) | 67% | 180 days
RG-015 | Rings | ₹12,000 | ₹14,400 | ₹2,400 (20%) | 243% | 30 days
BR-008 | Bracelets | ₹23,000 | ₹26,450 | ₹3,450 (15%) | 74% | 68 days
```

### 9. Command Center Module

**Database Tables:** None (aggregates across all stores)
**API Endpoints:** 12
**Frontend Pages:** 6
**Services:** None

**Key Features:**
- **Multi-Store Dashboard:** Aggregated view across all stores
- **Store Comparison:** Side-by-side metrics comparison
- **Financial Overview:** Cash, bank, receivables, payables by store
- **Loan Portfolio:** Active loans, overdue, LTV alerts by store
- **Orders & Repairs:** Custom orders and repairs dashboard
- **Customer Analytics:** Customer counts, tiers, loyalty by store
- **Activity Feed:** Real-time activity stream across all stores
- **Enhanced Alerts:** High priority, medium, low alerts aggregation

**Command Center is accessible only to:**
- `super_admin`: All stores
- `owner`: Owned stores
- `store_manager`: Assigned stores with permission

**Use Cases:**
- Owner with 3 stores can see consolidated performance
- Compare sales trends across branches
- Identify stores with high overdue loans
- Monitor inventory levels across locations
- Track employee performance across stores

### 10. Backup & Restore Module

**Database Tables:** None (uses filesystem and S3)
**API Endpoints:** 7
**Frontend Pages:** None (API-only, can be accessed via Command Center or CLI)
**Services:** BackupService, RestoreService

**Key Features:**
- **Automated Backups:** Scheduled daily backups via cron
- **On-Demand Backups:** Manual backup trigger via API
- **Partial Backups:** Backup specific tables only
- **Compression:** Gzip compression for space efficiency
- **Cloud Upload:** S3/MinIO integration for off-site storage
- **Backup Verification:** Integrity checks with pg_restore validation
- **Retention Policy:** Automatic cleanup of backups older than 30 days
- **Health Checks:** Database connectivity and table count validation
- **Restore Operations:** Full or partial table restoration
- **Dry-Run Mode:** Test restore without actually modifying database
- **Restore Points:** Create snapshot before destructive operations

**Backup Strategy:**
```
Daily Backups:
  - Scheduled at 2:00 AM (after interest accrual, before LTV calculation)
  - Full database dump with pg_dump
  - Gzip compression (reduces size by ~90%)
  - Upload to MinIO/S3
  - Local retention: 30 days
  - Cloud retention: 90 days

On-Demand Backups:
  - Triggered via API: POST /api/v1/backups
  - Before major operations (migrations, bulk imports)
  - Before system upgrades
  - For compliance/audit purposes

Backup Naming:
  backup_YYYYMMDD_HHmmss.sql.gz
  Example: backup_20260209_020000.sql.gz
```

**Restore Workflow:**
```
1. List Available Backups
   GET /api/v1/backups
   - Local backups in /backups
   - Cloud backups in S3 bucket

2. Get Backup Info
   GET /api/v1/backups/info?filename=backup_20260209_020000.sql.gz
   - File size
   - Creation date
   - Location (local/cloud)
   - Verification status

3. Dry-Run Restore (Recommended)
   POST /api/v1/backups/restore
   {
     "backupFileName": "backup_20260209_020000.sql.gz",
     "dryRun": true
   }
   - Validates backup integrity
   - Checks table structure
   - No actual data restoration

4. Create Restore Point (Important!)
   - Automatically creates backup before restore
   - Naming: restore_point_YYYYMMDD_HHmmss.sql.gz

5. Perform Restore
   POST /api/v1/backups/restore
   {
     "backupFileName": "backup_20260209_020000.sql.gz",
     "dryRun": false
   }
   - Downloads from cloud if needed
   - Drops existing tables
   - Restores from backup
   - Verifies restoration
   - Returns success/failure status

6. Verify Restoration
   GET /api/v1/backups/health
   - Checks database connectivity
   - Counts tables
   - Counts total records
   - Compares with pre-restore snapshot
```

---

## Deployment Considerations

### Production Checklist

**Environment:**
- [ ] Set NODE_ENV=production
- [ ] Generate strong JWT_SECRET (minimum 32 characters)
- [ ] Configure SMTP for production email service
- [ ] Set up WhatsApp Green API account
- [ ] Configure MinIO/S3 with production credentials
- [ ] Set proper ALLOWED_ORIGINS for CORS

**Database:**
- [ ] Run all migrations: `npm run db:migrate`
- [ ] Seed initial data: `npm run db:seed`
- [ ] Create super_admin user
- [ ] Create stores
- [ ] Set up chart of accounts
- [ ] Configure initial gold rates
- [ ] Set up leave types for HRM

**Infrastructure:**
- [ ] Configure PostgreSQL connection pooling
- [ ] Set up Redis persistence (AOF)
- [ ] Configure MinIO bucket policies
- [ ] Set up SSL certificates for all services
- [ ] Configure reverse proxy (Nginx/Caddy)
- [ ] Set up firewall rules

**Monitoring:**
- [ ] Configure application logging (winston)
- [ ] Set up error tracking (Sentry/similar)
- [ ] Configure uptime monitoring
- [ ] Set up database backup monitoring
- [ ] Configure disk space alerts

**Performance:**
- [ ] Enable PostgreSQL query optimization
- [ ] Configure Redis caching strategy
- [ ] Enable gzip compression
- [ ] Optimize Next.js build (ISR, SSG where applicable)
- [ ] Set up CDN for static assets

**Security:**
- [ ] Enable HTTPS only
- [ ] Configure helmet security headers
- [ ] Set up rate limiting
- [ ] Configure CORS properly
- [ ] Enable HTTP-only cookies
- [ ] Set secure session configuration
- [ ] Enable audit logging

**Backups:**
- [ ] Configure automated daily backups
- [ ] Test restore procedure
- [ ] Set up off-site backup storage
- [ ] Configure backup retention policy
- [ ] Set up backup monitoring and alerts

### Scaling Considerations

**Horizontal Scaling:**
- API servers can be load-balanced (stateless with Redis sessions)
- Database read replicas for reporting queries
- Redis cluster for high availability

**Vertical Scaling:**
- Database: Increase RAM for PostgreSQL caching
- Redis: Increase memory for session storage
- API servers: Increase CPU for concurrent requests

**Database Optimization:**
- Add indexes on frequently queried columns
- Partition large tables (auditLogs, activitySummaries)
- Archive old data (completed loans, old invoices)

---

## Recent Developments & Updates

### Phase 2: UI Polish, HRM & Safeguards (February 2026)
Major update focusing on user experience, localization, and system stability:

#### 1. UI/UX Polish
- **Dashboard:** Simplified daily interface removing complex analytical charts for clarity.
- **Navigation:** Semantic grouping of sidebar items for better discoverability.
- **Quick Actions:** Global quick action button in header (New Sale, New Loan, Add Customer).

#### 2. HRM Enhancements (Sri Lanka Localization)
- **Weekly Salary:** Support for weekly payroll cycles.
- **Employment Status:** Distinct tracking for Probation vs. Permanent employees.
- **Festive Bonuses:** Algorithms for Thaipongal, New Year, Deepavali, and Christmas bonuses.
- **Enhanced Profiles:** Added NIC number, photo, EPF/ETF details.

#### 3. Database Safeguards
- **Reset Protection:** `resetDb` utility restricted to test environment only.
- **Head Office Protection:** Prevented deletion/deactivation of MAIN-001 store.
- **Soft Deletes:** Enforced soft-delete patterns for critical entities.

#### 4. Inventory & Sales Updates
- **Stock Transfers:** Implemented inter-store stock transfer workflow.
- **Sales Returns:** Added comprehensive sales return functionality.
- **Label Quality:** Improved barcode sharpness and print quality.

### Cost Calculation Fix (February 2026)
Fixed inconsistencies in the rate-based cost calculation formulas:
- **Issue 1**: The rate-based cost calculation in the valuation method was dividing the gold rate by 8, causing inconsistency with the original cost calculation
- **Fix 1**: Removed the division by 8 to ensure both original cost and current market value use the same formula
- **Issue 2**: Both frontend and backend were using incorrect formulas; they were calculating `goldRatePerGram * netWeight * (1 + ratePercentage / 100)` instead of the correct `goldRatePerGram * netWeight * ratePercentage / 100`
- **Fix 2**: Updated both frontend and backend formulas to the correct calculation: `goldRatePerGram * netWeight * ratePercentage / 100`
- **Impact**: Corrected unrealized gain/loss calculations and ensured consistency between original cost and market value, and proper cost calculation using the correct formula where ratePercentage represents the percentage of the gold value

### Gold Pawning Module (February 2026)
The comprehensive gold loan management system has been implemented with:
- Complete loan lifecycle management
- RBI LTV compliance with automatic monitoring
- KYC verification system
- Margin call automation
- Auction/foreclosure workflow
- Interest rate configuration
- Daily LTV recalculation and interest accrual

### Label Designer & Printing (January 2026)
- Visual label designer with drag-and-drop interface
- Template-based label printing
- ZPL generation for thermal printers
- Individual item label printing
- Batch label printing functionality

### Backup & Recovery System (January 2026)
- Automated daily backups
- Cloud storage integration
- Backup verification and health checks
- Restore functionality with dry-run capability
- Retention policy management

### HRM Module (December 2025)
- Employee management
- Attendance tracking
- Leave management
- Payroll processing
- Salary advance requests

### Manufacturing & Karigar Management (December 2025)
- Karigar profiles and tracking
- Job card management
- Wastage tracking
- Labour charge calculation
- Scrap management

### ROI & Margin Analysis (December 2025)
- Item-level ROI tracking
- Margin analysis reports
- Metal profit/loss tracking
- Performance benchmarking

---

## Conclusion

The **MARI Jewellers ERP System** is a comprehensive, production-ready application built with modern technologies and best practices. The system handles the complete lifecycle of jewellery retail and manufacturing operations, from inventory management to customer relationships, financial accounting, and gold loan management.

**Key Strengths:**
- **Scalable Architecture:** Modular design with clear separation of concerns
- **Type Safety:** Full TypeScript across frontend and backend
- **Multi-Tenancy:** Store-scoped data isolation with role-based access control
- **Industry-Specific:** Fine gold accounting, RBI compliance, dual-ledger suppliers
- **Customer-Centric:** Loyalty program, RFM segmentation, churn prediction
- **Automation:** 11+ scheduled jobs for daily operations
- **Comprehensive:** 86+ tables, 305+ endpoints, 84+ pages, 290+ service methods
- **Enterprise-Grade:** Backup/restore, audit logs, activity tracking

**Total Development Effort:**
- **Backend:** 22+ services, 21+ API modules, 86+ database tables
- **Frontend:** 84+ pages, 15+ major modules, custom component library
- **Infrastructure:** Docker setup, scheduler service, backup system

This ERP system provides a solid foundation for jewellery businesses to manage their entire operations efficiently while maintaining compliance, tracking performance, and delivering excellent customer experiences.

---

**Document Version:** 2.0
**Last Updated:** February 13, 2026
**Prepared For:** MARI Jewellers Development Team