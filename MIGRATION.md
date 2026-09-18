# Migration Guide: Employee-Level Authorization

This guide explains how to migrate an existing DataMind installation to the new employee-level authorization system.

## Overview of Changes

The new authorization system adds:

1. **Employee ID mapping**: Each user account is now linked to an employee record
2. **Hierarchy-based access**: Admins can only access employees in their reporting hierarchy
3. **Self-only access**: Members can only access their own employee information
4. **Policy enforcement**: 11 access policies control what data users can query and modify
5. **Authorization-aware RPC functions**: Database functions enforce access control

## Breaking Changes

### 1. Admin and Member User Tables

**Old structure:**
```sql
create table admin_users (
  id bigint,
  username text unique,
  password_hash text,
  created_at timestamptz
);
```

**New structure:**
```sql
create table admin_users (
  id bigint,
  username text unique,
  password_hash text,
  created_at timestamptz,
  employee_id int4 references employee(id)  -- NEW
);
```

**Migration action:**
- The new `auth_setup.sql` drops and recreates these tables
- **⚠️ This will delete all existing user accounts**
- Back up your user accounts before running the new `auth_setup.sql`
- After running the script, recreate accounts and map each to an employee

### 2. Authentication RPC Return Values

**Old behavior:**
- `verify_admin_login(username, password)` returned `boolean`
- `verify_member_login(username, password)` returned `boolean`

**New behavior:**
- `verify_admin_login(username, password)` returns `int4` (employee_id or NULL)
- `verify_member_login(username, password)` returns `int4` (employee_id or NULL)

**Migration action:**
- The application code has been updated to handle the new return type
- No manual changes needed if you're updating the full application

### 3. Session Cookie Structure

**Old payload:**
```json
{
  "username": "admin",
  "role": "admin",
  "iat": 1234567890,
  "exp": 1234567890
}
```

**New payload:**
```json
{
  "username": "admin",
  "role": "admin",
  "employeeId": 1,
  "iat": 1234567890,
  "exp": 1234567890
}
```

**Migration action:**
- All existing sessions will be invalidated
- Users must log in again after deployment
- The new session token includes `employeeId` for authorization

### 4. Database RPC Function Signatures

**Old functions:**
```sql
execute_readonly_sql(query text)
execute_privileged_sql(query text)
```

**New functions:**
```sql
execute_authorized_sql(p_sql text, p_role text, p_employee_id int4)
execute_privileged_sql(p_sql text, p_role text, p_employee_id int4)
get_hierarchy(p_employee_id int4)
check_query_authorization(p_sql text, p_role text, p_employee_id int4)
```

**Migration action:**
- The old `execute_readonly_sql` is replaced by `execute_authorized_sql`
- All application code has been updated to pass role and employeeId
- The new `auth_setup.sql` creates all required functions

## Step-by-Step Migration

### Step 1: Backup Current State

```sql
-- Backup existing user accounts
CREATE TABLE admin_users_backup AS SELECT * FROM admin_users;
CREATE TABLE member_users_backup AS SELECT * FROM member_users;

-- Export account information (run in psql or Supabase SQL Editor)
COPY (SELECT username FROM admin_users) TO '/tmp/admin_usernames.csv' CSV HEADER;
COPY (SELECT username FROM member_users) TO '/tmp/member_usernames.csv' CSV HEADER;
```

### Step 2: Prepare Employee Mappings

Before running the migration, determine which employee each user should be mapped to:

```sql
-- List all employees
SELECT id, name, manager_id, dept_id FROM employee ORDER BY id;

-- Create a mapping plan
-- Example:
-- admin user 'john.manager' -> employee_id 5
-- member user 'jane.employee' -> employee_id 12
```

Create a mapping document:

| Username | Panel | Employee ID | Employee Name |
|----------|-------|-------------|---------------|
| admin | admin | 1 | John Manager |
| alice.lead | admin | 5 | Alice Lead |
| bob.member | member | 10 | Bob Member |
| carol.member | member | 15 | Carol Member |

### Step 3: Update Application Code

Pull the latest changes from the `feature/employee-authorization` branch:

```bash
git fetch origin feature/employee-authorization
git checkout feature/employee-authorization
npm install
```

### Step 4: Run Database Migration

1. **Run the new `auth_setup.sql` in Supabase SQL Editor:**

```sql
-- This will drop and recreate admin_users and member_users tables
-- WARNING: All existing accounts will be deleted
\i auth_setup.sql
```

2. **Create user accounts with employee mappings:**

```sql
-- Example: Create admin account mapped to employee 1
INSERT INTO admin_users (username, password_hash, employee_id)
VALUES ('admin', crypt('secure_password_here', gen_salt('bf')), 1);

-- Example: Create member account mapped to employee 2
INSERT INTO member_users (username, password_hash, employee_id)
VALUES ('member', crypt('secure_password_here', gen_salt('bf')), 2);
```

3. **Verify user mappings:**

```sql
-- Check admin mappings
SELECT u.username, u.employee_id, e.name AS employee_name
FROM admin_users u
LEFT JOIN employee e ON u.employee_id = e.id;

-- Check member mappings
SELECT u.username, u.employee_id, e.name AS employee_name
FROM member_users u
LEFT JOIN employee e ON u.employee_id = e.id;
```

### Step 5: Verify Employee Hierarchy

The authorization system relies on correct manager relationships:

```sql
-- Check manager hierarchy
WITH RECURSIVE hierarchy AS (
  SELECT id, name, manager_id, 1 AS level, ARRAY[id] AS path
  FROM employee
  WHERE manager_id IS NULL
  
  UNION ALL
  
  SELECT e.id, e.name, e.manager_id, h.level + 1, h.path || e.id
  FROM employee e
  INNER JOIN hierarchy h ON e.manager_id = h.id
  WHERE NOT (e.id = ANY(h.path))
)
SELECT 
  REPEAT('  ', level - 1) || name AS hierarchy,
  id,
  manager_id,
  level
FROM hierarchy
ORDER BY path;
```

**Look for:**
- Employees with no manager (should be top-level only)
- Cycles in the hierarchy (employee managing themselves indirectly)
- Orphaned employees (manager_id pointing to non-existent employee)

**Fix issues:**
```sql
-- Fix cycle: set manager_id to NULL or correct manager
UPDATE employee SET manager_id = NULL WHERE id = <problematic_id>;

-- Fix orphan: set correct manager
UPDATE employee SET manager_id = <correct_manager_id> WHERE id = <orphaned_id>;
```

### Step 6: Test Authorization

After migration, test the authorization system:

**Test 1: Member self-access (should succeed)**
```bash
# Login as member
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"member","password":"your_password","panel":"member"}'

# Get session
curl http://localhost:3000/api/auth/me -H "Cookie: datamind_session=<token>"

# Query own data
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -H "Cookie: datamind_session=<token>" \
  -d '{"question":"Show my employee information"}'
```

**Test 2: Member accessing other employee (should fail)**
```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -H "Cookie: datamind_session=<token>" \
  -d '{"question":"Show employee 5 salary"}'
```

**Test 3: Admin hierarchy access (should succeed)**
```bash
# Login as admin
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password","panel":"admin"}'

# Query hierarchy
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -H "Cookie: datamind_session=<token>" \
  -d '{"question":"Show all employees who report to me"}'
```

**Test 4: Admin accessing outside hierarchy (should fail)**
```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -H "Cookie: datamind_session=<token>" \
  -d '{"question":"Show the CEO salary"}' # if CEO not in admin hierarchy
```

### Step 7: Deploy Application

```bash
# Build production version
npm run build

# Run production server
npm start
```

**Post-deployment checklist:**
- ✅ All user accounts recreated with employee mappings
- ✅ Employee hierarchy verified (no cycles)
- ✅ Member self-access working
- ✅ Member blocked from accessing other employees
- ✅ Admin hierarchy access working
- ✅ Admin blocked from accessing outside hierarchy
- ✅ Write confirmations working for admin
- ✅ Old sessions invalidated (users must re-login)

## Common Migration Issues

### Issue: "Your account is not mapped to an employee"

**Cause:** User account has `employee_id = NULL`

**Fix:**
```sql
UPDATE admin_users SET employee_id = <correct_id> WHERE username = '<username>';
-- or
UPDATE member_users SET employee_id = <correct_id> WHERE username = '<username>';
```

### Issue: "Failed to retrieve employee hierarchy"

**Cause:** Cycle in manager relationships

**Debug:**
```sql
-- Find potential cycles
SELECT e1.id, e1.name, e1.manager_id, e2.name AS manager_name, e2.manager_id AS manager_manager_id
FROM employee e1
LEFT JOIN employee e2 ON e1.manager_id = e2.id
WHERE e1.manager_id IS NOT NULL;
```

**Fix:** Break the cycle by setting one employee's manager_id correctly

### Issue: Admin cannot access their own team

**Cause:** Manager relationship not set up correctly

**Debug:**
```sql
-- Check who reports to this admin
SELECT e.id, e.name, e.manager_id
FROM employee e
WHERE e.manager_id = <admin_employee_id>;

-- Check the admin's own manager
SELECT id, name, manager_id FROM employee WHERE id = <admin_employee_id>;
```

**Fix:** Ensure `employee.manager_id` relationships are correct

### Issue: Authorization errors for valid queries

**Cause:** Policy enforcement too strict or query analysis misinterpreting SQL

**Debug:**
1. Check the generated SQL in the error response
2. Review `check_query_authorization` logic in `auth_setup.sql`
3. Check application logs for authorization details

**Fix:** Adjust `check_query_authorization` function or query phrasing

## Rollback Procedure

If you need to roll back to the previous version:

### Step 1: Restore Application Code

```bash
git checkout main
npm install
npm run build
```

### Step 2: Restore Database Functions

Run the original `setup.sql` and `auth_setup.sql` from the `main` branch:

```sql
-- From main branch
\i setup.sql
\i auth_setup.sql
```

### Step 3: Restore User Accounts

```sql
-- Restore from backup
INSERT INTO admin_users (username, password_hash, created_at)
SELECT username, password_hash, created_at FROM admin_users_backup;

INSERT INTO member_users (username, password_hash, created_at)
SELECT username, password_hash, created_at FROM member_users_backup;
```

### Step 4: Redeploy Application

```bash
npm start
```

## Support

If you encounter issues during migration:

1. Check the troubleshooting section in README.md
2. Review database logs in Supabase dashboard
3. Check application logs for authorization errors
4. Verify employee hierarchy relationships
5. Ensure all required RPC functions exist (`\df` in psql)

## Next Steps

After successful migration:

1. **Audit employee mappings**: Ensure every user is mapped to the correct employee
2. **Test with real data**: Run typical queries to verify authorization works correctly
3. **Document access policies**: Share authorization rules with team members
4. **Monitor authorization failures**: Track rejected queries to identify policy issues
5. **Plan for user onboarding**: Update user documentation with authorization information
