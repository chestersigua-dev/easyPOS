# EasyPOS Hub — Enterprise Computer Parts POS & SaaS Platform

EasyPOS Hub is a modern, production-grade, enterprise Point of Sale (POS) system specifically designed for computer parts retailers. It features role-based access control (RBAC), multi-factor authentication (MFA), detailed inventory management, digital signature repair tickets, real-time visual accounting dashboards, and SuperAdmin sanitization reset wizards.

---

## Technical Stack

- **Monorepo Structure:** npm workspaces
- **Backend:** Node.js (Latest LTS), Fastify, TypeScript, Prisma ORM
- **Frontend:** React, Vite, Tailwind CSS, Zustand, Recharts
- **Database:** SQLite (default for development), PostgreSQL (for SaaS/production)
- **Security:** Helmet, CORS, Cookie Security, Rate Limiter, TOTP MFA, SHA256 Audit Logs
- **Exports/Prints:** xlsx (Excel spreadsheets), pdfkit (Receipt & repair ticket PDFs)

---

## Project Structure

```
easyPOS/
├── package.json                    # Workspace definition and root tasks
├── apps/
│   ├── api/                        # Fastify API Server
│   └── web/                        # React Vite Frontend Dashboard
├── packages/
│   ├── database/                   # Prisma database client & seed script
│   ├── shared/                     # Shared validation schemas (Zod)
│   ├── auth/                       # Hashing wrappers and token checks
│   └── ui/                         # Base layout tokens
├── docs/                           # Compliance manuals and operational guides
└── uploads/                        # Backup archives and static attachments
```

---

## Quick Start (Zero-Config Development)

The application automatically boots up an in-memory setup and SQLite database, running migrations and loading default seed data upon first startup.

### 1. Installation
Install monorepo dependencies:
```bash
npm install
```

### 2. Launch Local Servers
Run the dev server (starts the Fastify server on port 5000 and Vite client on port 5173 concurrently):
```bash
npm run dev
```

---

## Default Seed Credentials

All seed accounts are initialized with a standard developer password: `admin123`.

| Email Address | Default Password | Role | Access Level / Description |
|---|---|---|---|
| `superadmin@easypos.com` | `admin123` | **SUPERADMIN** | Root permissions, Settings editing, System backups, Deployment Reset wizard. |
| `admin@easypos.com` | `admin123` | **ADMIN** | Management level CRUD (Inventory adjustments, reports, users registration). |
| `accounting@easypos.com` | `accounting123` | **ACCOUNTING** | Financial reports, visual profit/loss, ledger, audit trail log viewing. |
| `sales@easypos.com` | `sales123` | **SALES** | High-speed checkout cash register, walk-in customers setup, quotes. |
| `repairs@easypos.com` | `repairs123` | **REPAIRS** | Repair ticket logs, technician assignment, status transition updates. |

---

## SOC2 Compliance & Security Features

- **Immutable Auditing:** All mutate endpoints (POST, PUT, DELETE) automatically write structural logs inside the `AuditLog` database table. Logs list IP addresses, browser agents, user scopes, and old vs new records.
- **Multi-Factor Authentication:** Standard Google Authenticator binding supported on the Settings panel for all user levels.
- **Zero-Trust RBAC Hook:** Endpoint actions check permissions mapped dynamically to user role associations.
- **Safety Backups:** Destruction buttons (Factory Reset, Deployment Sanitization) trigger database SQLite dumps before code execution.
