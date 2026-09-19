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

MEMBER and ADMIN authentication remains database-native because:

- verification occurs inside PostgreSQL RPC functions
- hierarchy authorization logic is SQL-centric
- authentication stays close to the data layer
- backend coordination is minimal
- SQL-native verification simplifies operational flow

---

## OWNER

OWNER passwords use:

```text
Node.js scrypt hashing
```

through:

```text
lib/auth/password.ts
```

Format:

```text
salt:hash
```

Example:

```text
f83a1c...:9ab21d...
```

OWNER authentication is intentionally separated from PostgreSQL-native hashing.

---

# Why OWNER Uses `scrypt`

OWNER accounts represent platform governance administrators rather than standard application users.

OWNER users can:

- manage schemas
- perform governed SQL execution
- administer database operations
- access audit infrastructure
- execute privileged workflows

Because of this elevated privilege level, OWNER authentication was designed as a backend-controlled security layer.

`scrypt` was selected because it provides:

- memory-hard password protection
- stronger GPU/ASIC resistance
- timing-safe verification
- backend-controlled authentication logic
- future MFA compatibility
- future SSO/OAuth extensibility
- independent governance auditing

This architecture is more suitable for privileged administrative access.

---

# Important Compatibility Note

OWNER passwords must NOT be generated using:

```sql
crypt()
gen_salt()
```

Those functions are valid only for:

- `member_users`
- `admin_users`

OWNER password hashes must be generated through the application hashing utilities.

Otherwise authentication fails because OWNER login expects:

```text
salt:hash
```

—not PostgreSQL bcrypt hash formats like:

```text
$2a$06$...
```

---

# Authentication Architecture Summary

| Role Type | Authentication Model |
|---|---|
| MEMBER | PostgreSQL `crypt()` |
| ADMIN | PostgreSQL `crypt()` |
| OWNER | Backend `scrypt` hashing |

This separation is intentional:

- MEMBER/ADMIN = application users
- OWNER = platform governance administrator

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
