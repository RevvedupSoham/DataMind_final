# DataMind — Managing Accounts, OWNER Access, and RLS

A complete operational reference for managing:

- MEMBER accounts
- ADMIN accounts
- OWNER accounts
- password changes
- login verification
- Supabase RLS security
- backend-only database access

All account management happens through the **Supabase SQL Editor**.

Never use:
- the Supabase Table Editor "Insert" button
- frontend forms
- manual hash editing

DataMind has no self-signup system.

---

# Why the SQL Editor Must Be Used

`admin_users`, `member_users`, and `owner_users` store:

```text
password_hash
```

—not plain-text passwords.

Those hashes are generated securely:

- MEMBER/ADMIN:
  - PostgreSQL `crypt(password, gen_salt('bf'))`
- OWNER:
  - application-side secure `scrypt` hashing

The Supabase Table Editor does not run hashing automatically.

If you manually type a password into `password_hash`, login will fail.

Always use SQL.

---

# MEMBER Accounts

## Create MEMBER

```sql
insert into member_users (username, password_hash)
values (
  'newmember',
  crypt('their-password', gen_salt('bf'))
);
```

---

## Change MEMBER Password

```sql
update member_users
set password_hash = crypt('their-new-password', gen_salt('bf'))
where username = 'newmember';
```

---

## Verify MEMBER Login

```sql
select verify_member_login(
  'newmember',
  'their-password'
);
```

Returns:

```text
true
```

or:

```text
false
```

---

# ADMIN Accounts

## Create ADMIN

```sql
insert into admin_users (username, password_hash)
values (
  'newadmin',
  crypt('their-password', gen_salt('bf'))
);
```

---

## Change ADMIN Password

```sql
update admin_users
set password_hash = crypt('their-new-password', gen_salt('bf'))
where username = 'newadmin';
```

---

## Verify ADMIN Login

```sql
select verify_admin_login(
  'newadmin',
  'their-password'
);
```

---

# OWNER Accounts

OWNER accounts are different from MEMBER and ADMIN accounts.

OWNER users:

- are not tied to employee hierarchy
- are not employee-scoped
- have database governance authority
- access the Owner Control Room
- use the governed SQL planning system

---

## OWNER Table Structure

```sql
owner_users
```

Columns:

| Column | Purpose |
|---|---|
| id | UUID / identifier |
| username | OWNER login username |
| password_hash | secure scrypt hash |
| display_name | owner display label |
| created_at | creation timestamp |

---

## Important OWNER Password Note

OWNER passwords are hashed by the application using:

```text
Node.js scrypt
```

—not PostgreSQL `crypt()`.

That means OWNER hashes should normally be generated through:

- backend utilities
- scripts
- seeded values

—not manually typed.

The format is:

```text
salt:hash
```

Example:

```text
4f3ab2...:8a92ff...
```

---

# View Existing Accounts

## MEMBER

```sql
select id, username, created_at
from member_users
order by created_at desc;
```

## ADMIN

```sql
select id, username, created_at
from admin_users
order by created_at desc;
```

## OWNER

```sql
select id, username, display_name, created_at
from owner_users
order by created_at desc;
```

---

# Remove Accounts

## MEMBER

```sql
delete from member_users
where username = 'newmember';
```

## ADMIN

```sql
delete from admin_users
where username = 'newadmin';
```

## OWNER

```sql
delete from owner_users
where username = 'ownername';
```

This only removes login access.

It does not affect:

- employee data
- salary data
- department records
- organizational data

---

# Supabase RLS Configuration

DataMind uses:

```text
Frontend
   ↓
Next.js API
   ↓
Service Role Key
   ↓
PostgreSQL
```

The browser never directly accesses protected tables.

Backend APIs authorize requests.

PostgreSQL enforces security.

Core philosophy:

```text
LLM interprets
Backend authorizes
PostgreSQL enforces
```

---

# Enable RLS on All Business Tables

Run in Supabase SQL Editor:

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

After enabling, Supabase should show:

```text
RLS enabled
```

instead of:

```text
UNRESTRICTED
```

---

# Recommended Phase 1 Policies

Because DataMind currently uses:

- custom session authentication
- backend authorization
- server-side service role access

—the safest Phase 1 setup is:

```text
Deny all browser access.
Allow backend-only access.
```

---

## Deny-All Policies

```sql
CREATE POLICY "deny_all_employee"
ON employee
FOR ALL
USING (false);

CREATE POLICY "deny_all_salary"
ON salary
FOR ALL
USING (false);

CREATE POLICY "deny_all_department"
ON department
FOR ALL
USING (false);

CREATE POLICY "deny_all_admin_users"
ON admin_users
FOR ALL
USING (false);

CREATE POLICY "deny_all_member_users"
ON member_users
FOR ALL
USING (false);

CREATE POLICY "deny_all_owner_users"
ON owner_users
FOR ALL
USING (false);

CREATE POLICY "deny_all_audit_logs"
ON audit_logs
FOR ALL
USING (false);
```

This prevents:

- accidental public access
- frontend direct-table access
- unauthorized browser queries

while still allowing:

- secure backend APIs
- service-role operations
- governed execution workflows

---

# SECURITY DEFINER RPC Functions

Functions used by the application should be created as:

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

Without `SECURITY DEFINER`, RLS may block function execution.

---

# Environment Variable Rules

## Browser / Client

Safe for frontend use:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

## Server Only

Never expose publicly:

```env
SUPABASE_SERVICE_ROLE_KEY=
```

This key bypasses RLS.

It must remain server-side only.

---

# Rules of Thumb

1. Always hash passwords properly.
2. Never manually type hashes.
3. Never expose `SUPABASE_SERVICE_ROLE_KEY`.
4. Always use SQL Editor for account operations.
5. Keep RLS enabled on all business tables.
6. Backend APIs should perform authorization.
7. PostgreSQL should enforce final security.
8. OWNER accounts are separate from employee hierarchy.
9. OWNER passwords use application-side scrypt hashing.
10. Browser users should never directly query protected tables.

---

# Final Security Model

DataMind currently operates as:

```text
Natural Language
        ↓
Execution Planning
        ↓
Authorization
        ↓
Governance Validation
        ↓
PostgreSQL Enforcement
        ↓
Audit Logging
```

This provides:

- governed database administration
- enterprise-grade RBAC
- auditability
- secure backend-controlled execution
- protected OWNER workflows
- Supabase RLS enforcement
