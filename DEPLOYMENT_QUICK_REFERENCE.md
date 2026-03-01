# 🚀 Deployment Quick Reference Card

## SAFE Deployment Commands

```bash
# 1. Stop application (keep database running)
docker stop <app-container>

# 2. Deploy new code
git pull origin main

# 3. Install dependencies
npm install

# 4. SAFE database initialization
npm run db:init

# 5. Ensure admin exists
npm run script:recreate-admin

# 6. Restart application
docker-compose up -d

# 7. Verify health
curl http://localhost:4000/health
```

## Emergency Commands

### Admin Locked Out
```bash
npm run script:recreate-admin
# Email: admin@marijewellers.com
# Password: Admin@123
```

### Custom Admin Credentials
```bash
npm run script:recreate-admin -- --email admin@custom.com --password Secure@123
```

### Reset Admin Password
```bash
npm run script:reset-admin-password
```

## Pre-Deployment Checklist

```bash
# Run in staging first
□ Deploy to staging
□ Test all critical features
□ Verify data persists

# Before production deploy
□ NODE_ENV=production npm run db:seed 2>&1 | grep "CRITICAL SAFETY"
□ npm run db:init
□ npm run script:recreate-admin
□ docker-compose restart postgres
□ psql $DATABASE_URL -c "SELECT count(*) FROM users"
□ pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
□ Notify team of deployment

# After deploy
□ curl http://localhost:4000/health
□ Login with admin credentials
□ Verify critical data exists
□ Check application logs
```

## Dangerous Commands (BLOCKED in Production)

```bash
# ❌ DO NOT run in production:
npm run db:seed              # Blocked by safety check
npm run script:reset-inventory # Resets inventory data
```

## Safe Commands (Anytime)

```bash
# ✅ Safe to run in production:
npm run db:init              # Migrations + admin check
npm run db:seed:safe         # Recreate admin only
npm run db:prepare           # Migrate + seed:safe
npm run script:recreate-admin # Admin recreation
npm run db:migrate           # Schema migrations
npm run db:studio            # Database GUI
```

## Backup & Restore

### Create Backup
```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore from Backup
```bash
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql
```

### Docker Backup
```bash
docker exec mari-erp-postgres pg_dump \
  -U mari_admin -d mari_erp_dev \
  > backup_$(date +%Y%m%d).sql
```

## Troubleshooting

### Database Connection Failed
```bash
docker ps | grep postgres
docker logs mari-erp-postgres
docker-compose restart postgres
```

### Admin Login Fails
```bash
npm run script:recreate-admin
# Use new credentials
```

### Data Missing After Deploy
```bash
# Check if seed ran incorrectly
NODE_ENV=production npm run db:seed

# Restore from backup
pg_dump $DATABASE_URL > emergency_backup.sql
# Then investigate
```

### Volume Issues
```bash
docker volume ls | grep postgres
docker volume inspect mari-erp-postgres_data
```

## Environment Variables

### Production (.env.production)
```bash
NODE_ENV=production
DATABASE_URL=postgresql://...
ALLOW_PRODUCTION_SEED=false  # EXPLICIT BLOCK
```

### Development (.env)
```bash
NODE_ENV=development
DATABASE_URL=postgresql://localhost:5432/mari_erp_dev
```

## Quick Health Checks

```bash
# API Health
curl http://localhost:4000/health

# Database Connection
psql $DATABASE_URL -c "SELECT 1"

# User Count
psql $DATABASE_URL -c "SELECT count(*) FROM users"

# Store Count
psql $DATABASE_URL -c "SELECT count(*) FROM stores"

# Admin Exists
psql $DATABASE_URL -c "SELECT email FROM users WHERE email LIKE '%admin%'"

# Docker Status
docker ps

# Volume Status
docker volume inspect mari-erp-postgres_data
```

## Contact & Escalation

If database wipe occurs again:

1. **STOP** - Do not run any more commands
2. **CHECK** - `docker volume ls | grep postgres`
3. **BACKUP** - Check `docker exec mari-erp-postgres ls /backups`
4. **RESTORE** - See `BACKUP_SYSTEM_DOCUMENTATION.md`
5. **RECREATE** - `npm run script:recreate-admin`

---

**Last Updated**: 2026-02-16
**Status**: ✅ Database wipe fix deployed
**Documentation**: `DATABASE_WIPE_FIX.md`
