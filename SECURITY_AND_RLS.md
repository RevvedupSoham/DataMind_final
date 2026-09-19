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

---

# Security Philosophy

```text
LLM interprets
Backend authorizes
PostgreSQL enforces
```

---

# Role Architecture

| Role | Purpose |
|---|---|
| MEMBER | Employee self-service |
| ADMIN | Organizational management |
| OWNER | Database governance |

---

# Authentication

## MEMBER & ADMIN

Uses PostgreSQL:

```sql
crypt(password, gen_salt('bf'))
```

Verification:

- verify_member_login()
- verify_admin_login()

---

## OWNER

OWNER passwords use:

```text
Node.js scrypt hashing
```

Format:

```text
salt:hash
```

---

# Route Protection

Protected routes:

| Route | Protection |
|---|---|
| `/owner` | OWNER-only |
| `/api/owner/*` | OWNER-only |

Implemented using middleware and centralized authorization helpers.

---

# Audit Infrastructure

Audit categories:

- OWNER login success
- OWNER login failure
- operation planning
- SQL governance checks

Audit table:

```text
audit_logs
```

---

# SQL Governance Flow

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

# Supabase RLS Strategy

Architecture:

```text
Frontend
   ↓
Next.js API
   ↓
SUPABASE_SERVICE_ROLE_KEY
   ↓
PostgreSQL
```

Browser users never directly access protected tables.

---

# Enable RLS

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

# Recommended Policies

Recommended Phase 1 approach:

```text
Deny browser access.
Allow backend-only access.
```

Example:

```sql
CREATE POLICY "deny_all_employee"
ON employee
FOR ALL
USING (false);
```

---

# SECURITY DEFINER Functions

Recommended for:

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

---

# Environment Variable Security

Frontend-safe:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Backend-only:

```env
SUPABASE_SERVICE_ROLE_KEY=
```

Never expose the service role key publicly.
