# Backup and Recovery System for MARI Jewellers ERP

## Overview
This document describes the backup and recovery system implemented for the MARI Jewellers ERP system. The system provides automated backups, verification, monitoring, and restoration capabilities to ensure business continuity and data safety.

## Architecture

### Components
1. **Backup Service** - Core service for creating database backups
2. **Restore Service** - Service for restoring from backups
3. **Backup Scheduler** - Automated scheduling for regular backups
4. **Backup Controller** - API endpoints for backup operations
5. **Monitoring System** - Health checks and verification

### Data Flow
- Automated backups run on schedule (daily/weekly)
- Backups stored locally and optionally in cloud storage (MinIO/S3)
- Verification jobs ensure backup integrity
- Monitoring tracks backup health and storage usage

## Configuration

### Environment Variables
```bash
# Backup configuration
BACKUP_DIR=./backups                    # Local backup directory
BACKUP_RETENTION_DAYS=30               # Days to retain local backups
BACKUP_COMPRESS=true                   # Compress backup files
UPLOAD_BACKUPS_TO_CLOUD=true           # Upload backups to cloud storage
BACKUP_BUCKET_NAME=erp-backups         # Cloud storage bucket name

# Cloud storage configuration
MINIO_ENDPOINT=http://localhost:9000   # MinIO endpoint
MINIO_ACCESS_KEY=your_access_key       # MinIO access key
MINIO_SECRET_KEY=your_secret_key       # MinIO secret key
S3_REGION=us-east-1                    # S3 region

# Scheduling configuration
DAILY_BACKUP_TIME="0 2 * * *"          # Cron expression for daily backups (2 AM)
WEEKLY_BACKUP_TIME="0 3 * * 0"         # Cron expression for weekly backups (Sunday 3 AM)
CLEANUP_JOB_TIME="0 4 * * *"           # Cron expression for cleanup (4 AM daily)
```

## Backup Operations

### Creating Backups
Backups can be created in three types:
- **Full**: Complete database backup
- **Daily**: Incremental backup for daily operations
- **Weekly**: Comprehensive backup for weekly retention
- **Partial**: Backup of specific tables only

### Backup Verification
- Basic verification: Checks file integrity
- Comprehensive verification: Validates all critical tables
- Dry-run capability: Test restores without affecting live data

### Scheduling
- Daily backups at 2 AM (by default)
- Weekly backups on Sundays at 3 AM (by default)
- Automatic cleanup of old backups based on retention policy

## Restoration Operations

### Full Restoration
Restores the entire database from a backup file.

### Partial Restoration
Restores specific tables from a backup file, useful for recovering individual components without affecting the entire system.

### Pre-Restoration Safety
- Creates a restore point (backup) before performing restoration
- Dry-run option to validate the restoration process
- Verification of backup integrity before restoration

## Monitoring and Alerting

### Backup Statistics
- Total number of backups
- Total storage used
- Oldest and newest backup dates
- Verification status

### Health Checks
- Database connectivity
- Table counts and record counts
- Potential issues detection

### Storage Monitoring
- Disk usage tracking
- Available space monitoring
- Usage percentage alerts

## Security Considerations

### Encryption
- Backups are encrypted in transit to cloud storage
- Secure credential management for cloud storage access

### Access Control
- RBAC integration for backup operations
- Role-based permissions (super_admin, store_manager)
- Audit logging for all backup activities

## Best Practices

### Regular Testing
- Test restoration procedures regularly
- Verify backup integrity periodically
- Monitor backup job success rates

### Retention Policies
- Balance storage costs with recovery requirements
- Keep both short-term and long-term backups
- Consider compliance requirements for financial data

### Monitoring
- Set up alerts for backup failures
- Monitor storage capacity trends
- Track verification success rates

## API Endpoints

### Backup Creation
```
POST /api/v1/backups
Authorization: Bearer <token>
Content-Type: application/json

{
  "backupType": "full|daily|weekly|partial",
  "tables": ["table1", "table2"] // for partial backups
}
```

### List Backups
```
GET /api/v1/backups
Authorization: Bearer <token>
```

### Restore from Backup
```
POST /api/v1/backups/restore
Authorization: Bearer <token>
Content-Type: application/json

{
  "backupFileName": "backup_file.sql.gz",
  "dryRun": true|false
}
```

### Backup Statistics
```
GET /api/v1/backups/stats
Authorization: Bearer <token>
```

### Health Check
```
GET /api/v1/backups/health
Authorization: Bearer <token>
```

## Emergency Procedures

### Data Loss Incident
1. Assess the extent of data loss
2. Identify the most recent valid backup
3. Create a restore point of current state
4. Perform restoration using dry-run first
5. Execute actual restoration after verification
6. Validate data integrity after restoration

### Backup Failure
1. Check backup logs for error details
2. Verify database connectivity
3. Check storage space availability
4. Validate cloud storage credentials
5. Retry backup operation
6. Escalate if failure persists

## Maintenance Tasks

### Regular Maintenance
- Monitor backup job success rates
- Review and adjust retention policies
- Test restoration procedures quarterly
- Update backup schedules as needed

### Storage Management
- Monitor storage usage trends
- Adjust retention policies based on usage
- Archive old backups to cheaper storage
- Clean up failed backup attempts

## Compliance Considerations

### Financial Data
- Maintain 7-year retention for financial records
- Ensure backup encryption for sensitive data
- Regular testing of restoration procedures
- Audit trails for all backup operations

### Customer Data
- Protect customer information in backups
- Ensure GDPR compliance in backup procedures
- Secure deletion of old customer data backups