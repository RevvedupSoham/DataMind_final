# DataMind — Security & RLS Architecture

This document explains the current security architecture used by DataMind.

It covers:

- RBAC
- OWNER governance
- Supabase RLS
- backend authorization
- service-role isolation
- audit logging
- execution governance
- database protection strategy

---

# Security Philosophy

DataMind follows a layered governance model:

```text
LLM interprets
Backend authorizes
PostgreSQL enforces
```

This means:

- AI assists with interpretation
- backend APIs enforce authorization
- PostgreSQL enforces final security boundaries
- audit logs track all governed actions

---

# Role Architecture

| Role | Purpose | Capabilities |
|---|---|---|
| MEMBER | Employee self-service | Read-only scoped access |
| ADMIN | Organization management | Controlled DML operations |
| OWNER | Database governance | Controlled DQL/DML/DDL/DCL |

---

# Authentication Architecture

## MEMBER & ADMIN

Authentication is handled through:

- `member_users`
- `admin_users`

Passwords use PostgreSQL:

```sql
crypt(password, gen_salt('bf'))
```

Verification uses:

- `verify_member_login()`
- `verify_admin_login()`

---

## OWNER Authentication

OWNER accounts use:

```text
owner_users
```

OWNER passwords use:

```text
Node.js scrypt hashing
```

Format:

```text
salt:hash
```

OWNER authentication is:

- database-backed
- audit logged
- session protected
- middleware enforced

---

# Session Security

Current session model:

- HTTP-only cookies
- signed session payloads
- 30-minute inactivity timeout
- protected middleware validation

Session payload:

```text
{
  username,
  role,
  employeeId
}
```

---

# Route Protection

Protected routes include:

| Route | Protection |
|---|---|
| `/owner` | OWNER-only |
| `/api/owner/*` | OWNER-only |
| admin APIs | hierarchy-scoped |
| member APIs | self-scoped |

Implemented through:

```text
middleware.ts
```

and centralized authorization helpers.

---

# Audit Infrastructure

All governed operations should be audit logged.

Current audit categories:

- OWNER login success
- OWNER login failure
- operation planning
- SQL governance checks
- execution planning

Audit table:

```text
audit_logs
```

---

# SQL Governance Layer

The OWNER workspace does not directly execute arbitrary SQL.

Every operation follows:

```text
Natural Language
        ↓
Operation Planning
        ↓
Authorization
        ↓
Risk Classification
        ↓
Validation
        ↓
Confirmation
        ↓
Execution
        ↓
Audit Logging
```

---

# SQL Safety Enforcement

Dangerous operations are classified by risk.

| Risk | Meaning |
|---|---|
| LOW | Safe read/query |
| MEDIUM | Controlled create/update |
| HIGH | Destructive modification |
| CRITICAL | Blocked privileged operations |

Examples of blocked patterns:

```sql
DROP DATABASE
ALTER SYSTEM
COPY PROGRAM
GRANT SUPERUSER
pg_sleep()
```

---

# Supabase RLS Strategy

DataMind uses:

```text
Frontend
   ↓
Next.js API
   ↓
SUPABASE_SERVICE_ROLE_KEY
   ↓
PostgreSQL
```

Browser clients never directly access protected business tables.

The backend performs authorization.

RLS prevents unintended public access.

---

# Enable RLS

Recommended tables:

```sql
ALTER TABLE employee ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary ENABLE ROW LEVEL SECURITY;
ALTER TABLE department ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE dept_assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE address ENABLE ROW LEVEL SECURITY;
```

---

# Phase 1 Recommended Policies

Current architecture recommendation:

```text
Deny direct browser access.
Allow backend-only access.
```

Example:

```sql
CREATE POLICY "deny_all_employee"
ON employee
FOR ALL
USING (false);
```

This ensures:

- frontend users cannot query tables directly
- service-role backend APIs remain operational
- PostgreSQL still enforces security boundaries

---

# SECURITY DEFINER RPC Functions

Functions used by the application should use:

```sql
SECURITY DEFINER
```

Examples:

- verify_admin_login
- verify_member_login
- execute_authorized_sql
- execute_privileged_sql
- execute_readonly_sql
- get_hierarchy

Example:

```sql
CREATE OR REPLACE FUNCTION verify_admin_login(...)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  ...
END;
$$;
```

Without `SECURITY DEFINER`, RLS may block execution.

---

# Environment Variable Security

## Frontend Safe Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

## Backend-Only Variables

```env
SUPABASE_SERVICE_ROLE_KEY=
```

Never expose the service role key publicly.

It bypasses RLS protections.

---

# Current Security State

| Area | Status |
|---|---|
| OWNER authentication | Implemented |
| RBAC middleware | Implemented |
| Audit infrastructure | Implemented |
| SQL governance | Implemented |
| RLS strategy | Defined |
| Route protection | Implemented |
| Schema introspection | Implemented |
| Operation planning | Implemented |

---

# Future Security Roadmap

Planned upgrades:

- Supabase JWT integration
- true per-user RLS policies
- zero-trust row authorization
- execution sandboxing
- advanced audit analytics
- execution replay tooling
- policy simulation
- query anomaly detection

---

# Final Outcome

DataMind now operates as a governed database administration platform with:

- enterprise RBAC
- OWNER governance
- backend-controlled execution
- PostgreSQL enforcement
- Supabase RLS protection
- auditability
- natural-language operation planning
