# 🚨 DATABASE WIPE FIX - Emergency Deployment Guide

## Problem Summary
Database was being wiped on every deploy/update, causing:
- Loss of all admin users → login lockout
- Loss of all customer data
- Loss of all inventory, orders, settings

## Root Cause Analysis

### Primary Cause: Seed Script Running on Deploy
The `db:seed` script was likely being run automatically during deployment, which:
1. Checks for existing store `MAIN-001`
2. If found, exits safely
3. **BUT** if the check fails or migrations drop tables, it recreates everything

### Contributing Factors
1. No production safety checks in seed script
2. No idempotent admin creation script
3. Deployment process may run `db:seed` unnecessarily

---

## ✅ EMERGENCY FIX (Deploy Today)

### What Was Changed

#### 1. Seed Script Safety (`apps/api/src/db/seed.ts`)
- Added `NODE_ENV === 'production'` block
- Added `ALLOW_PRODUCTION_SEED` environment variable check
- Added existing user count check before proceeding
- Script now exits safely if data already exists

#### 2. Safe Admin Recreation (`apps/api/src/scripts/recreate-admin.ts`)
- **NEW SCRIPT** - Creates/resets admin WITHOUT wiping data
- Idempotent - safe to run multiple times
- Preserves all existing users, customers, inventory
- Only creates/updates the admin user

#### 3. Safe Database Init (`apps/api/src/db/init.ts`)
- **NEW SCRIPT** - Runs migrations + ensures admin exists
- Does NOT drop tables or delete data
- Safe for production deployments

### New NPM Scripts

```bash
# SAFE for production deployments:
npm run db:init          # Migrations + admin check (SAFE)
npm run db:seed:safe     # Only recreate admin (SAFE)
npm run db:prepare       # Migrate + seed:safe (SAFE)

# UNSAFE - DO NOT run in production:
npm run db:seed          # Original seed script (BLOCKED in production)
```

---

## 📋 DEPLOYMENT PROCEDURE (Safe)

### For Next Deployment

```bash
# 1. Stop current application (keep database running)
docker stop <app-container>

# 2. Deploy new code
git pull origin main

# 3. Install dependencies
npm install

# 4. Run SAFE database initialization
npm run db:init

# 5. Restart application
npm run docker:up
# OR your deployment command

# 6. Verify admin access
curl http://localhost:4000/health
```

### If Admin is Locked Out

```bash
# Recreate admin with default password
npm run script:recreate-admin

# Or with custom credentials
npm run script:recreate-admin -- --email admin@marijewellers.com --password NewSecure@123
```

---

## 🔒 LONG-TERM FIX (Architecture)

### 1. Separate Migration from Seeding

**Current Problem**: `db:seed` does too much.

**Solution**: Split into distinct operations:
```bash
# Migrations - schema changes only (always safe)
npm run db:migrate

# Initial data - roles, permissions (run once)
npm run db:seed:initial

# Admin user - idempotent (safe anytime)
npm run db:seed:admin
```

### 2. Environment-Based Deployment

Create `.env.production`:
```bash
NODE_ENV=production
DATABASE_URL=postgresql://...
ALLOW_PRODUCTION_SEED=false  # Explicit block
```

### 3. CI/CD Pipeline Safety

Add to your deployment pipeline:
```yaml
# Example GitHub Actions
- name: Database Migration
  run: npm run db:init
  env:
    NODE_ENV: production
    DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
    # NEVER set ALLOW_PRODUCTION_SEED in CI/CD

- name: Verify Admin Exists
  run: npm run script:recreate-admin
  continue-on-error: true  # Non-blocking
```

### 4. Database Backup Before Deploy

```bash
# Add to deployment script
npm run backup:create  # If backup module exists
# OR
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## 🧪 PRE-DEPLOYMENT CHECKLIST

Run these before deploying to production:

```bash
# 1. Verify seed script is blocked
NODE_ENV=production npm run db:seed
# Expected: "CRITICAL SAFETY" error

# 2. Verify init script works
npm run db:init
# Expected: "Database is ready for use"

# 3. Verify admin can be recreated
npm run script:recreate-admin
# Expected: "Admin user exists" or "Created admin user"

# 4. Verify data persists
psql $DATABASE_URL -c "SELECT count(*) FROM users;"
# Expected: Your actual user count

# 5. Verify migrations are safe
npm run db:generate
# Review generated migration - should NOT have DROP TABLE

# 6. Check volume persistence
docker volume inspect mari-erp-postgres_data
# Expected: Mountpoint exists, not empty

# 7. Test in staging first
# Deploy to staging environment and verify

# 8. Backup current production database
pg_dump $DATABASE_URL > pre_deploy_backup.sql

# 9. Verify rollback procedure
# Document how to restore from backup

# 10. Team communication
# Notify team of deployment window
```

---

## 📁 Files Modified/Created

| File | Change | Purpose |
|------|--------|---------|
| `apps/api/src/db/seed.ts` | Modified | Added production safety checks |
| `apps/api/src/scripts/recreate-admin.ts` | Created | Safe admin creation |
| `apps/api/src/db/init.ts` | Created | Safe database initialization |
| `apps/api/package.json` | Modified | Added safe scripts |
| `package.json` | Modified | Added safe scripts |

---

## 🆘 Emergency Contacts

If database is wiped again:

1. **DO NOT PANIC** - Data can be restored from backup
2. **Stop deployment immediately**
3. **Check backup location**: `docker exec mari-erp-postgres ls /backups`
4. **Restore from backup**: See `BACKUP_SYSTEM_DOCUMENTATION.md`
5. **Recreate admin**: `npm run script:recreate-admin`

---

## 📚 Related Documentation

- `BACKUP_SYSTEM_DOCUMENTATION.md` - Backup and restore procedures
- `README.md` - General setup and deployment
- `QUICKSTART.md` - Quick start guide
- `SETUP_GUIDE.md` - Detailed setup instructions

---

**Last Updated**: 2026-02-16
**Status**: ✅ Emergency fix deployed
