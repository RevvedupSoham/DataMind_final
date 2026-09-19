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
- administer privileged database workflows

OWNER passwords use application-side `scrypt` hashing.

Hash format:

```text
salt:hash
```

Example:

```text
f83a1c...:9ab21d...
```

---

# Why OWNER Uses `scrypt`

OWNER accounts represent platform governance administrators rather than standard application users.

OWNER users can:

- perform governed SQL execution
- manage schemas
- administer database operations
- access audit infrastructure
- execute privileged workflows

Because of this elevated privilege level, OWNER authentication was intentionally separated from PostgreSQL-native hashing.

`scrypt` was selected because it provides:

- memory-hard password protection
- stronger GPU/ASIC resistance
- timing-safe verification
- backend-controlled authentication
- future MFA compatibility
- future SSO/OAuth extensibility
- independent governance auditing

---

# Important OWNER Compatibility Note

OWNER passwords must NOT be generated using:

```sql
crypt()
gen_salt()
```

Those are valid only for:

- `member_users`
- `admin_users`

If a PostgreSQL bcrypt hash is inserted into `owner_users.password_hash`, OWNER login will fail.

Incorrect format:

```text
$2a$06$...
```

Correct format:

```text
salt:hash
```

---

# How to Create an OWNER Account

OWNER hashes must be generated through the application hashing utility.

## Step 1 — Create Hash Generator Script

Create:

```text
scripts/generate-owner-hash.ts
```

Contents:

```ts
import { hashPassword } from "@/lib/auth/password";

async function main() {
  const hash = await hashPassword("YOUR_OWNER_PASSWORD");
  console.log(hash);
}

main();
```

---

## Step 2 — Generate Hash

Run:

```bash
npx tsx scripts/generate-owner-hash.ts
```

Example output:

```text
f83a1cf0f9a1f2...:9ab21dff01ab...
```

---

## Step 3 — Insert OWNER Account

Use the generated hash in Supabase:

```sql
insert into owner_users (
  username,
  password_hash,
  display_name
)
values (
  'OWNER',
  'PASTE_GENERATED_HASH_HERE',
  'Primary Owner'
);
```

---

# How to Change an OWNER Password

Generate a new `scrypt` hash using the script above.

Then update:

```sql
update owner_users
set password_hash = 'NEW_SCRYPT_HASH'
where username = 'OWNER';
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
3. OWNER accounts require `scrypt` hashes.
4. MEMBER/ADMIN accounts use PostgreSQL `crypt()`.
5. Always use SQL Editor for account management.
6. Keep RLS enabled on business tables.
7. Backend APIs should authorize requests.
8. PostgreSQL should enforce final security.
9. Browser users should never directly query protected tables.
