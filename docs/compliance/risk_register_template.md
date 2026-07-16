# SOC2 Compliance Risk Register Template

This document provides a template for tracking risks related to the Security, Confidentiality, and Availability Trust Services Criteria (TSC) for EasyPOS Hub.

| Risk ID | Risk Description | TSC Area | Likelihood | Impact | Mitigating Controls | Current Status |
|---|---|---|---|---|---|---|
| **RSK-01** | Unauthorized database access leading to PII/financial leakage. | Security / Confidentiality | Low | High | - JWT validation on API endpoints.<br>- Database-driven RBAC checking.<br>- AES encryption on sensitive fields. | Controlled |
| **RSK-02** | Data loss from server hardware crash or database corruption. | Availability | Medium | High | - Scheduled automated system backups.<br>- SQLite dev.db copy with SHA256 hashing. | Active |
| **RSK-03** | Unauthorized admin reset actions wiping client data. | Security / Integrity | Low | Critical | - Deployment reset restricted to SuperAdmin.<br>- Password & MFA token check before actions.<br>- Immutable audit log record output. | Controlled |
| **RSK-04** | Session hijacking via stale browser cookies. | Security | Medium | Medium | - Refresh token rotation policy.<br>- HttpOnly, Secure, SameSite cookie flags.<br>- Short access token lifecycle (15 mins). | Active |
