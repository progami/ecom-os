# WMS Integration Rollback Plan

## Overview
This document provides detailed procedures for safely rolling back the WMS integration at any stage if critical issues arise. Each rollback scenario includes specific steps and verification procedures.

## Rollback Triggers

### Severity Levels
- **CRITICAL**: Data corruption, authentication failure, complete system outage
- **HIGH**: Major functionality broken, performance degraded >50%, financial calculations incorrect
- **MEDIUM**: Minor features broken, UI issues, non-critical API failures
- **LOW**: Cosmetic issues, minor performance impact

**Rollback Decision**: Initiate rollback for CRITICAL issues immediately. HIGH issues trigger rollback if not resolved within 2 hours.

## Pre-Integration Preparation

### 1. Create Backups
```bash
# Database backup
pg_dump -h localhost -U postgres -d ecom_os > backup/db_backup_$(date +%Y%m%d_%H%M%S).sql

# Code backup
git checkout -b backup/pre-wms-integration-$(date +%Y%m%d)
git push origin backup/pre-wms-integration-$(date +%Y%m%d)

# File system backup
tar -czf backup/project_files_$(date +%Y%m%d_%H%M%S).tar.gz \
  app/ components/ lib/ prisma/ package.json

# Environment backup
cp .env backup/.env.$(date +%Y%m%d_%H%M%S)
```

### 2. Document Current State
```bash
# Save current package versions
npm list --depth=0 > backup/npm_packages_$(date +%Y%m%d).txt

# Save database schema
prisma db pull
cp prisma/schema.prisma backup/schema_$(date +%Y%m%d).prisma

# Document running services
pm2 save
pm2 dump > backup/pm2_$(date +%Y%m%d).json
```

## Rollback Scenarios

### Scenario 1: Package Installation Failure

**Trigger**: npm install fails or introduces breaking changes

**Rollback Steps**:
```bash
# Step 1: Restore package files
cp backup/package.json ./package.json
cp backup/package-lock.json ./package-lock.json

# Step 2: Clean and reinstall
rm -rf node_modules
npm cache clean --force
npm install

# Step 3: Verify
npm run build
npm run type-check
```

### Scenario 2: Database Migration Failure

**Trigger**: Prisma migration fails or corrupts data

**Rollback Steps**:
```bash
# Step 1: Stop all services
npm run stop
pm2 stop all

# Step 2: Restore database
dropdb ecom_os
createdb ecom_os
psql -U postgres -d ecom_os < backup/db_backup_[timestamp].sql

# Step 3: Restore schema file
cp backup/schema_[date].prisma prisma/schema.prisma

# Step 4: Generate Prisma client
npm run prisma:generate

# Step 5: Verify database
npm run prisma:studio
```

### Scenario 3: Partial File Migration Failure

**Trigger**: Files moved but imports broken, build failing

**Rollback Steps**:
```bash
# Step 1: Identify point of failure
git status
git diff

# Step 2: Rollback file changes
git checkout -- app/wms/
git checkout -- components/wms/
git checkout -- lib/wms/

# Step 3: Remove created directories
rm -rf app/wms
rm -rf components/wms
rm -rf lib/wms
rm -rf app/api/v1/wms

# Step 4: Restore from backup if needed
tar -xzf backup/project_files_[timestamp].tar.gz
```

### Scenario 4: Complete Integration Failure

**Trigger**: Multiple systems failing, data integrity compromised

**Full Rollback Procedure**:
```bash
#!/bin/bash
# full_rollback.sh

echo "Starting full WMS integration rollback..."

# Step 1: Stop all services
echo "Stopping services..."
npm run stop
pm2 stop all
systemctl stop nginx

# Step 2: Backup current failed state (for analysis)
echo "Backing up failed state..."
mkdir -p backup/failed_state
pg_dump -h localhost -U postgres -d ecom_os > backup/failed_state/db_failed.sql
tar -czf backup/failed_state/code_failed.tar.gz app/ components/ lib/

# Step 3: Restore database
echo "Restoring database..."
dropdb ecom_os
createdb ecom_os
psql -U postgres -d ecom_os < backup/db_backup_[timestamp].sql

# Step 4: Restore code
echo "Restoring code..."
git checkout backup/pre-wms-integration-[date]
git checkout -b main-rollback

# Step 5: Restore dependencies
echo "Restoring dependencies..."
rm -rf node_modules
cp backup/package*.json ./
npm install

# Step 6: Restore environment
echo "Restoring environment..."
cp backup/.env.[timestamp] .env

# Step 7: Regenerate Prisma
echo "Regenerating Prisma client..."
npm run prisma:generate

# Step 8: Restart services
echo "Restarting services..."
pm2 resurrect backup/pm2_[date].json
systemctl start nginx

echo "Rollback complete!"
```

## Verification Procedures

### Post-Rollback Verification
```bash
#!/bin/bash
# verify_rollback.sh

echo "Verifying rollback..."

# Check services running
if pm2 list | grep -q "online"; then
  echo "✓ Services running"
else
  echo "✗ Services not running"
  exit 1
fi

# Check database connection
if npm run prisma:studio -- --browser false; then
  echo "✓ Database connected"
else
  echo "✗ Database connection failed"
  exit 1
fi

# Check build
if npm run build; then
  echo "✓ Build successful"
else
  echo "✗ Build failed"
  exit 1
fi

# Check main app
if curl -s http://localhost:3000 | grep -q "Ecom OS"; then
  echo "✓ Main app responsive"
else
  echo "✗ Main app not responding"
  exit 1
fi

echo "All checks passed!"
```

## Recovery Procedures

### Data Recovery
If data was modified during integration:
```sql
-- Identify affected records
SELECT * FROM audit_log 
WHERE created_at > '[integration_start_time]'
ORDER BY created_at DESC;

-- Restore specific tables if needed
TRUNCATE TABLE wms_inventory_transaction;
COPY wms_inventory_transaction FROM '/backup/inventory_data.csv';
```

### User Communication
```markdown
## System Maintenance Notice

The WMS integration has been temporarily rolled back due to technical issues.

**Impact**:
- WMS features temporarily unavailable
- All other systems operating normally
- No data has been lost

**Timeline**:
- Rollback completed: [time]
- Services restored: [time]
- Next attempt scheduled: [date]

Please contact support with any questions.
```

## Lessons Learned Documentation

After any rollback, document:
1. **Root Cause**: What triggered the rollback?
2. **Detection Time**: How long until the issue was identified?
3. **Impact**: Which systems/users were affected?
4. **Resolution**: What specific steps resolved the issue?
5. **Prevention**: How can this be avoided in future?

### Template:
```markdown
# Rollback Post-Mortem: [Date]

## Incident Summary
- **Start Time**: 
- **Detection Time**: 
- **Rollback Decision**: 
- **Resolution Time**: 

## Root Cause

## Impact

## Resolution Steps

## Preventive Measures

## Action Items
- [ ] 
- [ ] 
```

## Emergency Contacts

- **Database Admin**: [contact]
- **DevOps Lead**: [contact]
- **Project Manager**: [contact]
- **On-call Engineer**: [contact]

## Rollback Checklist

### Pre-Integration
- [ ] Database backup completed
- [ ] Code backup in git
- [ ] File system backup created
- [ ] Environment backup saved
- [ ] Current state documented
- [ ] Rollback scripts tested

### During Rollback
- [ ] Services stopped
- [ ] Failed state backed up
- [ ] Database restored
- [ ] Code restored
- [ ] Dependencies restored
- [ ] Environment restored
- [ ] Services restarted

### Post-Rollback
- [ ] All services running
- [ ] Database accessible
- [ ] Build successful
- [ ] Application responsive
- [ ] Users notified
- [ ] Post-mortem scheduled