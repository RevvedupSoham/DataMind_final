# DataMind — Managing Accounts, OWNER Access, and RLS

A complete operational reference for managing:

- MEMBER accounts
- ADMIN accounts
- OWNER accounts
- password changes
- login verification
- Supabase RLS security
- backend-only database access

All account management happens through the Supabase SQL Editor.

Never use:
- the Supabase Table Editor "Insert" button
- frontend forms
- manual hash editing

DataMind has no self-signup system.

---

# Why the SQL Editor Must Be Used

`admin_users`, `member_users`, and `owner_users` store `password_hash` values — not plain-text passwords.

Hashing methods:

- MEMBER/ADMIN:
  - PostgreSQL `crypt(password, gen_salt('bf'))`
- OWNER:
  - application-side `scrypt` hashing

The Table Editor does not run hashing automatically.

Always use SQL statements.

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

## Change MEMBER Password

```sql
update member_users
set password_hash = crypt('their-new-password', gen_salt('bf'))
where username = 'newmember';
```

## Verify MEMBER Login

```sql
select verify_member_login(
  'newmember',
  'their-password'
);
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

## Change ADMIN Password

```sql
update admin_users
set password_hash = crypt('their-new-password', gen_salt('bf'))
where username = 'newadmin';
```

## Verify ADMIN Login

```sql
select verify_admin_login(
  'newadmin',
  'their-password'
);
```

---

# OWNER Accounts

OWNER users are separate from employee hierarchy management.

They:

- access the Owner Control Room
- manage governed database workflows
- use natural-language planning
- access controlled SQL governance tools

OWNER passwords use application-side `scrypt` hashing.

Hash format:

```text
salt:hash
```

---

# Enable Supabase RLS

Recommended business tables:

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

Current architecture:

```text
Frontend
   ↓
Next.js API
   ↓
Service Role Key
   ↓
PostgreSQL
```

Recommended policy model:

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

---

# Environment Variable Rules

## Frontend Safe

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Backend Only

```env
SUPABASE_SERVICE_ROLE_KEY=
```

Never expose the service role key publicly.

---

# Rules of Thumb

1. Always hash passwords properly.
2. Never manually type hashes.
3. Always use SQL Editor for account management.
4. Keep RLS enabled on business tables.
5. OWNER accounts are separate from employee hierarchy.
6. Backend APIs should authorize requests.
7. PostgreSQL should enforce final security.
8. Browser users should never directly query protected tables.
