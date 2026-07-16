# Architecture & Operations Guide

This guide details the system architectures, backup-recovery workflows, and database entity relationships for EasyPOS Hub.

---

## 1. Database Entity Relationships (ERD)

All tables relate dynamically via Prisma schemas:

```
+------------+        +----------+        +-------------+
|   Tenant   |1------*|   User   |1------*|  AuditLog   |
+------------+        +----------+        +-------------+
      |                     |
      |                     |1 (Assigned Tech)
      |                     v
      |               +----------+
      |1------------* |  Repair  |
      |               |  Ticket  |*-------1 [Customer]
      |               +----------+
      |                     |
      |                     |1
      |                     v
      |               +----------+
      |               |  Status  |
      |               | History  |
      |               +----------+
      |
      |               +----------+        +-------------+
      |1------------* |   Sale   |1------*|  SaleItem   |
      |               +----------+        +-------------+
      |                     |1                   |*
      |                     v                    v1
      |               +----------+        +-------------+
      |               | Payment  |        |   Product   |
      |               +----------+        +-------------+
      |                                          |1
      |                                          v*
      |1-----------------------------------* [Movement]
```

---

## 2. Backup & Recovery Policy (SOC2)

The application automatically creates database snapshots before running destruct options.

### Creating Manual Backups
Backups are saved inside `uploads/backups/db_backup_[Timestamp].db` using a raw SQLite byte-stream copy. A SHA256 checksum is calculated and logged.

### Restoring Snapshots
1. Go to **Sanitize Reset** (SuperAdmin only).
2. Re-enter your password to authenticate.
3. Select the target backup from the recovery list.
4. Click **Restore**. The system performs a checksum validation, creates an emergency rollback copy of `dev.db`, and replaces the database file.

---

## 3. Production Configuration & Environment Variables

Create an `.env` file at the root to configure the system for SaaS or production:

```ini
# Server Configuration
PORT=5000
HOST=0.0.0.0
NODE_ENV=production

# Database (Leave blank to use SQLite by default)
DATABASE_URL="postgresql://db_user:password@localhost:5432/easypos"

# Security Keys
JWT_ACCESS_SECRET="your-production-access-secret-minimum-32-chars"
JWT_REFRESH_SECRET="your-production-refresh-secret-minimum-32-chars"
COOKIE_SECRET="cookie-secret-key-999333"

# CORS Rules
CORS_ORIGIN="https://pos.yourdomain.com"
```
