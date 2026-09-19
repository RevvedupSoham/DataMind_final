# DataMind

**Ask your database in plain English — with employee-level authorization.**

DataMind turns a natural-language question about an employee database into a
real PostgreSQL query, runs it against your actual Supabase database with
employee-level access control, and shows you the SQL, the data, and — when it
makes sense — a chart. There is no mock data anywhere in the pipeline: the
database is the single source of truth, and the LLM's only job is translating
English into SQL.

DataMind sits behind role-specific authentication. ADMIN and MEMBER accounts use **employee-mapped authorization**, while OWNER accounts use a separate platform-level control plane. Each user
account is linked to an employee record, and all queries are enforced with
role-based AND employee-level access policies:

- **Member** — read-only, self-only access. Can ask about their own employee
  data, salary, address, and approved aggregate queries (department counts,
  etc.). Cannot access other employees' individual information.
  
- **Admin** — read and write, hierarchy-based access. Can query and modify data
  for themselves, their direct reports, and all indirect reports (unlimited
  depth with cycle protection). Admin writes require explicit confirmation.

## OWNER Control Room

DataMind also has a separate **OWNER control plane** for platform-level database
operations. OWNER authentication is independent of employee hierarchy
authentication and carries no employee ID.

OWNER requests follow this lifecycle:

```
OWNER login
   ↓
Natural-language operational request
   ↓
Groq · openai/gpt-oss-120b
   ↓
Generated PostgreSQL operation
   ↓
Independent OWNER SQL governance
   ↓
Risk classification
   ↓
Signed, short-lived approval token
   ↓
Explicit confirmation for writes/destructive operations
   ↓
Dedicated execute_owner_sql RPC
   ↓
PostgreSQL
   ↓
Audit log
```

OWNER does **not** execute through the ADMIN employee-scoped RPC. This keeps
platform-level database control separate from employee hierarchy authorization.

The OWNER SQL governance layer permits only one operation at a time and blocks
privilege-management statements, authentication-table access, arbitrary
server/file functions, multi-statement execution, and unqualified UPDATE/DELETE
operations. The database RPC repeats the critical safety checks as a
defense-in-depth boundary.

The OWNER approval token is bound to the authenticated OWNER username and the
exact generated SQL, and expires after a short period. This prevents changing
the reviewed SQL between planning and execution.

---

## Problem & solution

Non-technical stakeholders can't write SQL, and engineers don't want to be a
human query API. Traditional database interfaces lack granular access control.
DataMind closes that gap with **natural language + authorization**:

```
Login (member or admin) → mapped to employee_id\nOWNER login → platform-level control plane
   ↓
Natural language question
   ↓
LLM (Groq · openai/gpt-oss-120b) — role-aware prompt
   ↓
PostgreSQL statement
   ↓
Independent server-side safety validation (role-aware)
   ↓
Employee-level authorization check (role + employee_id)
   ↓
Read: execute with authorization via RPC
   Write (admin only): held for explicit confirmation
   ↓
Authorized SQL execution (hierarchy-based or self-only)
   ↓
Real rows (filtered by authorization)
   ↓
SQL viewer + dynamic result table + optional visualization
```

The LLM never sees or returns data — it only ever produces a SQL string. All
filtering, joining, counting, ranking, aggregation, AND authorization happen
in Postgres.

## Authorization Model

### Employee Mapping

Every user account (admin or member) is mapped to an `employee_id` in the
`employee` table. This mapping is stored in `admin_users.employee_id` or
`member_users.employee_id` and is returned by the authentication RPCs on login.

The session cookie carries `{username, role, employeeId}`, signed with
HMAC-SHA256. Authorization decisions are made server-side using this verified
employee context. The authorization rules are account-independent: any number
of admin accounts (for example admin, admin1, admin2, etc.) can exist, and each
admin receives the hierarchy belonging to that admin's mapped employee_id.

### Member Access Policies (POLICY 1, 2, 8)

**POLICY 1: Individual Access**
- Members can access individual employee information ONLY for themselves
- Own employee record, own salary, own address, own job_history (limited)
- Cannot retrieve individual data of any other employee

**POLICY 2: Aggregate Access**
- Members have LIMITED aggregate access
- Approved: employee counts, department counts, general department info
- Restricted: salary statistics (SUM/AVG/MAX/MIN of salary.amount)

**POLICY 8: Department Access**
- Members can see their own department information
- Approved general/non-sensitive department metadata
- No access to other employees just because they're in the same department

**POLICY 10: Rejection Policy**
- If a member asks for restricted information, the query is REJECTED entirely
- No silent filtering or partial results
- Example: "Show everyone's salary" → Authorization error (not just own salary)

### Admin Access Policies (POLICY 3, 4, 5, 6, 7)

**POLICY 3: Hierarchy-Based Individual Access**
- Admin scope includes: self, direct reports, indirect reports (all depths)
- Hierarchy is determined by `employee.manager_id → employee.id`
- Each admin's scope is resolved from the signed session employee_id, never from
  the username and never from a hardcoded administrator ID
- Uses PostgreSQL recursive CTEs with cycle protection
- Admin CANNOT access unrelated employees (even if same department)

**POLICY 4: Salary Access**
- Admins can access individual salary for employees in their hierarchy only
- Includes: self, all direct and indirect reports
- Cannot access salaries outside the hierarchy

**POLICY 5: Address Access**
- Admins can access full address (city, state, pin_code) for hierarchy only
- Same scope as salary: self + all reports

**POLICY 6: Job History Access**
- Admins can access LIMITED job_history fields
- Allowed: `new_role`, `changed_on`
- RESTRICTED: `old_role` (blocked for everyone, including admins)
- Scope: self + direct/indirect reports

**POLICY 7: Hybrid Department-Wide Access**
- Department membership does NOT grant individual employee access
- Approved non-sensitive department-wide queries allowed (counts, metadata)
- Being a department head does NOT expose individual salaries/addresses/etc.
  for employees outside the admin's reporting hierarchy

### Write Authorization (POLICY 9)

**Member: Strictly READ-ONLY**
- No INSERT, UPDATE, DELETE, schema changes, or data modification
- All write attempts are rejected

**Admin: Controlled Write Access**
- Can modify permitted application data within authorized scope
- Write scope: employee profile, salary, address, department assignment
- Must be within admin's authorization scope (hierarchy-based)
- Authentication/security tables (admin_users, member_users) are protected
- All writes require explicit user confirmation (never automatic)

### Hierarchy Implementation (POLICY 11)

Admin hierarchy traversal:
- Unlimited depth via PostgreSQL `WITH RECURSIVE`
- Cycle protection (malformed manager relationships won't cause infinite loops)
- Implemented in `get_hierarchy(p_employee_id)` RPC function
- Returns all employee IDs in the manager's reporting tree

## Multi-account authorization behavior

There is no single "admin employee" in DataMind. The mapping is per account:

```
admin1 -> admin_users.employee_id = 101 -> hierarchy(101)
admin2 -> admin_users.employee_id = 205 -> hierarchy(205)
admin3 -> admin_users.employee_id = 317 -> hierarchy(317)

member1 -> member_users.employee_id = 401 -> own scope(401)
member2 -> member_users.employee_id = 402 -> own scope(402)
```

The numbers above are illustrative only. DataMind never hardcodes them. At
runtime the signed session supplies the authenticated employee_id, and the
database verifies that the employee_id belongs to an account of the claimed
role before authorizing the query.

### Existing database

If your database already has `admin_users` / `member_users` and working
accounts, **do not rerun `auth_setup.sql`**, because that file creates those
tables. Run the whole `auth_authorization_patch.sql` in Supabase SQL Editor
instead. It preserves the existing accounts and upgrades the authorization
functions.

### Fresh database

Run `setup.sql`, then `auth_setup.sql`, then `auth_authorization_patch.sql`.
The final patch is intentionally applied after the base auth setup so fresh
and existing installations use the same multi-account authorization behavior.

## Member workspace

Members have a dedicated read-only experience as well as a separate login panel.
The member workspace exposes personal-data queries (details, department, address,
current salary, and permitted job history) plus approved general aggregates.
The UI does not expose admin controls or CSV export to members, and the backend
still enforces the same scope independently of the interface.

## Architecture

```
app/
  layout.tsx                Root layout, fonts, metadata
  page.tsx                  Landing page composition (behind login)
  login/page.tsx            Login screen: Admin / Member tabs
  globals.css               Tailwind base + design tokens
  api/
    query/route.ts          Generates + validates SQL with authorization.
                            Executes reads with employeeId context;
                            returns writes as "pending confirmation"
    query/confirm/route.ts  ONLY route that executes admin writes.
                            Re-validates statement and enforces authorization
    auth/login/route.ts     Verifies credentials, returns employeeId,
                            issues signed session cookie with role + employeeId
    auth/logout/route.ts    Clears the session cookie
    auth/me/route.ts        Returns current session (username, role, employeeId)
    health/route.ts         Supabase connectivity check

components/
  Navigation.tsx          Overlay nav + user menu (shows role & employeeId)
  Hero.tsx                Hero section
  HowItWorks.tsx          4-step explainer
  QueryInterface.tsx      Core product: input, confirmation, results
  SuggestedQuestions.tsx  Quick-start question chips
  SQLViewer.tsx           Generated SQL + copy button
  ResultView.tsx          Table/Bar/Line/Pie tabs + Download CSV
  ResultTable.tsx         Dynamic, type-aware result table
  ChartRenderer.tsx       Recharts bar/line/pie renderer
  Examples.tsx            Required example questions
  VisualizationSection.tsx "From answers to insight" + footer

lib/
  csv.ts                  Client-side CSV export (only exports already-
                          authorized data returned to user's session)
  ask-bridge.ts           Window-event bridge for triggering questions
  auth/session.ts         Signs/verifies session cookies with employeeId
  llm/groq.ts             Groq client (server-only, role-aware)
  sql/
    schema.ts             VERIFIED_SCHEMA + LLM system prompts (member/admin)
    validator.ts          Independent role-aware SQL safety validator
    authorization.ts      Employee-level authorization utilities
  database/supabase.ts    Supabase client, authorization-aware RPCs:
                          - executeReadonlyQuery(sql, role, employeeId)
                          - executePrivilegedQuery(sql, role, employeeId)
                          - verifyCredentials → {role, employeeId}
                          - getAdminHierarchy(employeeId) → employee IDs
  visualization/engine.ts Decides chart type from actual returned rows

types/
  auth.ts         SessionPayload with employeeId, roles
  database.ts     Row types + DatabaseSchema shape
  query.ts        Query/response/status types, pending confirmation
  visualization.ts ChartType + VisualizationConfig
  css.d.ts        Ambient module for plain CSS imports

middleware.ts    Redirects unauthenticated requests to /login
                (JSON 401 for /api/* routes)

setup.sql         One-time Supabase SQL: execute_readonly_sql RPC
auth_setup.sql    One-time Supabase SQL:
                  - admin_users/member_users tables with employee_id
                  - verify_admin_login/verify_member_login (return employeeId)
                  - get_hierarchy(p_employee_id) recursive function
                  - check_query_authorization(sql, role, employeeId)
                  - execute_authorized_sql with policy enforcement
                  - execute_privileged_sql with authorization

auth_authorization_patch.sql
                  Existing-DB hardening patch. Run this after auth_setup.sql
                  to enable account-independent hierarchy validation for any
                  number of admins/members without recreating auth tables.
```

## Security Architecture

### Authentication Flow

1. User selects Admin or Member panel and enters credentials
2. Server calls `verify_admin_login` or `verify_member_login` RPC
3. RPC returns `employee_id` on success, `NULL` on failure
4. Server creates signed session token: `{username, role, employeeId, iat, exp}`
5. Token stored in httpOnly, secure, sameSite=lax cookie
6. All subsequent requests verify token and extract `role + employeeId`

### Authorization Flow (Read Query)

1. User asks natural language question
2. Server verifies session → extracts `role + employeeId`
3. Groq LLM generates SQL (role-aware prompt, but NOT trusted for security)
4. Server validates SQL syntax + safety (`lib/sql/validator.ts`)
5. Server checks authorization (`lib/sql/authorization.ts` analysis)
6. Server calls `execute_authorized_sql(sql, role, employeeId)` RPC
7. Database function `check_query_authorization` enforces policies:
   - Members: self-only or approved aggregates
   - Admins: hierarchy-based or approved department queries
8. Database executes authorized query, returns results
9. Server returns SQL + results + visualizations to client

### Authorization Flow (Admin Write)

1. Admin asks question that requires write (INSERT/UPDATE/DELETE/etc.)
2. Server generates and validates SQL
3. Server returns SQL as **pending confirmation** (does not execute)
4. Admin reviews SQL and clicks "Confirm & Run"
5. Server re-verifies session (must be admin) and re-validates SQL
6. Server calls `execute_privileged_sql(sql, role, employeeId)` RPC
7. Database function blocks:
   - Writes to admin_users/member_users
   - Privilege escalation (GRANT, REVOKE, etc.)
   - Dangerous operations
8. Database executes write within admin's authorized scope
9. Server returns result confirmation

### Defense in Depth

**Layer 1: LLM Prompt**
- Role-aware system prompts (member=read-only, admin=write-capable)
- Not a security boundary, just behavioral guidance

**Layer 2: SQL Safety Validator** (`lib/sql/validator.ts`)
- Independent server-side validation
- Checks: statement type, forbidden keywords, multiple statements, dangerous functions
- Role-aware: members cannot get write SQL, admins can

**Layer 3: Authorization Analyzer** (`lib/sql/authorization.ts`)
- Detects sensitive data access (salary, address, job_history)
- Enforces policy-based access (self-only for members, hierarchy for admins)
- Rejects unauthorized queries (POLICY 10: no silent filtering)

**Layer 4: Database RPC Functions** (`auth_setup.sql`)
- `execute_authorized_sql`: enforces read authorization at DB level
- `execute_privileged_sql`: enforces write authorization at DB level
- `check_query_authorization`: SQL-level policy enforcement
- `get_hierarchy`: recursive hierarchy with cycle protection

**Layer 5: Supabase Service Role**
- All RPC functions grant execute to `service_role` only
- Never grant to `anon` or `authenticated` (client-side roles)
- Server-side credential usage only

### Security Limitations

**Not Implemented:**
- Fine-grained column-level authorization within authorized rows
- Minimum aggregate group size (deliberately no threshold)
- Row-level security (RLS) policies (service role bypasses RLS; using explicit authorization functions instead)
- Audit logging of query execution
- Rate limiting per user
- Data masking or redaction

**Known Constraints:**
- LLM-generated SQL cannot be 100% guaranteed to be scoped correctly
  (defense in depth provides rejection on policy violation)
- Authorization policies are enforced at query validation time, not during SQL generation
- Admins with large hierarchies may experience slower hierarchy resolution
- No support for temporary elevated access or delegation

## Database Schema

The application uses these tables (see `setup.sql` and existing schema):

**employee**
- `id` (PK), `name`, `hire_date`, `manager_id` → employee.id, `dept_id` → department.id

**department**
- `id` (PK), `name`, `location`, `head_of_department` → employee.id

**salary**
- `employee_id` (PK, FK → employee.id), `amount`, `currency`, `effective_from`

**address**
- `employee_id` (PK, FK → employee.id), `city`, `state`, `pin_code`

**job_history**
- `id` (PK), `employee_id` (FK → employee.id), `old_role`, `new_role`, `changed_on`

**dept_assignment**
- `employee_id` (PK, FK → employee.id), `dept_id` (PK, FK → department.id), `allocation_percent`

**admin_users** (authentication + authorization)
- `id` (PK), `username` (unique), `password_hash`, `created_at`, `employee_id` (FK → employee.id)

**member_users** (authentication + authorization)
- `id` (PK), `username` (unique), `password_hash`, `created_at`, `employee_id` (FK → employee.id)

## Setup

### Prerequisites

- Node.js 18+ and npm
- A Supabase project with the employee/department/salary/address/job_history/dept_assignment tables already created
- Environment variables (see `.env.example`)

### Environment Variables

Create `.env.local`:

```bash
# Server-side Groq credentials (NEVER expose to browser)
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b

# Supabase project
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your_supabase_secret_key

# App URL (for server-side config)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Session signing secret (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
SESSION_SECRET=your_64_character_hex_secret
```

### Database Setup

1. **Run setup.sql** in Supabase SQL Editor (creates `execute_readonly_sql` RPC)
2. **Run auth_setup.sql** in Supabase SQL Editor (creates auth tables, RPCs, authorization functions)
3. **Map users to employees**: Update the seed data in `auth_setup.sql` or manually insert records:

```sql
-- Example: map admin account to employee 1, member account to employee 2
UPDATE admin_users SET employee_id = 1 WHERE username = 'admin';
UPDATE member_users SET employee_id = 2 WHERE username = 'member';
```

4. **Verify employee hierarchy**: Ensure `employee.manager_id` relationships are correct

### Install & Run

```bash
npm install
npm run dev
```

Navigate to `http://localhost:3000` and log in.

**Default accounts (CHANGE PASSWORDS):**
- Admin: `admin` / `change-me-admin`
- Member: `member` / `change-me-member`

## Example Questions

**Member (self-only) queries:**
- "Show my employee information"
- "What is my current salary?"
- "What city do I live in?"
- "How many employees are in each department?" (aggregate)
- "Show my job history"

**Admin (hierarchy-based) queries:**
- "Show all employees who report to me directly or indirectly"
- "In my team, who earns the second highest salary?"
- "Which of my reports work in more than one department?"
- "List the addresses of all my direct and indirect reports"
- "How many people are in my reporting hierarchy?"

**Admin write examples (with confirmation):**
- "Give employee 5 a raise to 95000 effective today"
- "Update my address to 123 Main St, New York, NY, 10001"
- "Add a new department named 'Research' located in 'Boston'"

**Queries that demonstrate authorization:**
- Member asks: "Show everyone's salary" → ❌ Authorization error
- Member asks: "What is my salary?" → ✅ Returns their own salary
- Admin asks: "Show salaries for employees outside my hierarchy" → ❌ Authorization error
- Admin asks: "Show salaries for my team" → ✅ Returns hierarchy salaries

## API Health Check

```bash
curl http://localhost:3000/api/health
```

Returns database connectivity status.

## Testing Authorization

### Member Tests

```bash
# Login as member
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"member","password":"change-me-member","panel":"member"}'

# Try to access other employee data (should fail)
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -H "Cookie: datamind_session=<token>" \
  -d '{"question":"Show me employee ID 1s salary"}'

# Access own data (should succeed)
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -H "Cookie: datamind_session=<token>" \
  -d '{"question":"Show my salary"}'
```

### Admin Tests

```bash
# Login as admin
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"change-me-admin","panel":"admin"}'

# Query hierarchy
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -H "Cookie: datamind_session=<token>" \
  -d '{"question":"Show all employees in my reporting hierarchy"}'

# Try to access employee outside hierarchy (should fail)
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -H "Cookie: datamind_session=<token>" \
  -d '{"question":"Show the CEO salary"}' # if CEO is not in admin hierarchy
```

## Production Deployment

Before deploying to production:

1. ✅ Change default passwords in `admin_users` and `member_users`
2. ✅ Generate strong `SESSION_SECRET` (64+ character hex)
3. ✅ Set `NODE_ENV=production`
4. ✅ Enable `secure: true` for cookies (HTTPS only)
5. ✅ Review and customize authorization policies in `auth_setup.sql`
6. ✅ Audit employee_id mappings for all user accounts
7. ✅ Verify manager hierarchy relationships in `employee` table
8. ✅ Test hierarchy-based access with real organizational structure
9. ✅ Implement audit logging if required
10. ✅ Set up monitoring and alerting for authorization failures

## Troubleshoties

**"The Supabase authorization function is missing"**
→ Run `auth_setup.sql` in the Supabase SQL Editor

**"Your account is not mapped to an employee"**
→ Update `admin_users.employee_id` or `member_users.employee_id` for the user

**"Members can only access their own employee information"**
→ Expected behavior for member accounts asking about other employees

**"Admin access requires specifying which employees"**
→ Admin queries for individual data need WHERE clauses to specify scope

**Hierarchy not working correctly**
→ Check `employee.manager_id` relationships for cycles or incorrect mappings

**Authorization errors for valid queries**
→ Review `check_query_authorization` logic in `auth_setup.sql`

## License

MIT
