# DataMind — Final Change & Implementation Plan

## 1. Project Goal

DataMind is a natural-language database interface where users ask questions in plain English and receive answers from the real PostgreSQL database.

Core principle:

> **The LLM interprets. The backend authorizes. PostgreSQL executes.**

The LLM is never the source of truth and never decides whether a user is authorized to access a record.

---

## 2. Final Role Architecture

DataMind will use three application roles.

### MEMBER

Employee self-service access.

- View own employee details.
- View own department information.
- View own address.
- View own current salary.
- View permitted job-history information.
- Run approved general aggregate queries.
- Read-only.
- Cannot modify database records.
- Cannot access another employee's individual information.

### ADMIN

Hierarchy-based business/data management.

- View own data.
- View direct and indirect reports at unlimited hierarchy depth.
- Read permitted employee, salary, address, department and job-history information within hierarchy.
- Modify permitted application data within hierarchy.
- Explicit confirmation required before writes.
- Cannot modify authentication/security tables.
- Cannot use unrestricted database-administration privileges.

### OWNER

Database administration/control role.

- Database-wide application access, subject to the actual PostgreSQL/Supabase role permissions.
- Natural-language database operations are the primary workflow.
- Dedicated Database Control Room.
- Schema Explorer.
- Schema Management.
- Database Health.
- Activity/Audit Log.
- Advanced Raw SQL Console.
- Supports database administration operations only where the underlying database role permits them.
- Destructive/high-risk operations require preview and explicit confirmation.

---

## 3. Authentication

### Existing roles

Existing authentication remains based on:

- `admin_users`
- `member_users`

Each account is mapped to an employee where applicable.

### Owner

A separate:

`owner_users`

table will be introduced with:

- `id`
- `username`
- `password_hash`
- `display_name`
- `created_at`

Owner accounts do not require an `employee_id`.

The session becomes role-aware:

`{ username, role, employeeId, iat, exp }`

For Owner, `employeeId` is `null`.

No hardcoded Owner password or hidden application backdoor will be used.

---

## 4. Natural-Language Query Pipeline

All roles continue to use the same basic natural-language interaction model.

```
User question
     ↓
Role/session context
     ↓
LLM interpretation
     ↓
SQL/action generation
     ↓
Independent safety validation
     ↓
Target resolution, where required
     ↓
Server-side authorization
     ↓
Preview / confirmation for writes
     ↓
PostgreSQL execution
     ↓
Real database result
     ↓
Table + SQL + visualization
```

The LLM is not trusted for authorization.

---

## 5. Admin Target Resolution + Multi-Select

This is a major safety and usability addition for Admin write operations.

Example:

> Delete all details of the employee whose name is Arjun Mehta.

If multiple employees have that name, DataMind must not generate a name-based destructive query.

Instead:

```
Natural-language request
        ↓
Resolve candidate employees
        ↓
Restrict candidates to Admin hierarchy
        ↓
Show matching employees
        ↓
Admin selects one or more targets
        ↓
Re-check authorization
        ↓
Preview affected records
        ↓
Final confirmation
        ↓
Execute using stable employee IDs
```

### Example

```
MULTIPLE MATCHES FOUND

☐ 104  Arjun Mehta
      Finance · Senior Analyst

☐ 187  Arjun Mehta
      Engineering · Software Engineer

2 employees selected

[ Cancel ] [ Continue ]
```

The Admin may explicitly select both employees.

### Important rule

> **Names are used to find candidates. Employee IDs are used for execution.**

The client-selected IDs are never trusted by themselves. The backend must re-verify that every selected employee belongs to the authenticated Admin's hierarchy.

---

## 6. Destructive Operation Confirmation

Operations such as DELETE, bulk UPDATE, TRUNCATE, DROP, and other high-risk actions require controlled confirmation.

For a request such as:

> Delete all details of both Arjun Mehta employees.

DataMind should show:

- Exact selected employees.
- Employee IDs.
- Departments/roles as safe identifying context.
- Tables/records that will be affected.
- Generated SQL/action.
- Final confirmation control.

Only after confirmation should the operation execute.

Where multiple related tables are affected, the implementation should prefer an atomic database transaction so the operation either completes consistently or rolls back.

---

## 7. Authorization Rules

### MEMBER

Individual access:

- Own employee only.
- Own salary only.
- Own address only.
- Own permitted job history only.

Aggregate access:

- Approved workforce/department counts.
- General department metadata.
- Restricted salary statistics remain blocked.

Unauthorized queries are rejected rather than silently filtered.

### ADMIN

Scope:

- Self.
- Direct reports.
- Indirect reports.
- Unlimited hierarchy depth.
- Cycle protection.

The hierarchy is derived from:

`employee.manager_id → employee.id`

Sensitive access must remain inside that hierarchy.

### OWNER

Owner authorization is not employee-hierarchy based.

Owner operations are governed by:

1. authenticated Owner session,
2. operation safety rules,
3. database permissions,
4. explicit confirmation for destructive/high-risk actions.

---

## 8. Job History Rules

For Admin:

Allowed:

- `new_role`
- `changed_on`

Restricted:

- `old_role`

For Member:

- Own permitted job history only.
- `old_role` remains restricted.

---

## 9. Result Views

Query results continue to use real PostgreSQL rows.

The result workspace provides:

- Table
- Bar
- Line
- Pie

The application does not issue separate database queries for each chart.

One authorized result set feeds the visualization layer.

No fake chart data is generated.

For data that cannot meaningfully support a chart, the UI should avoid fabricating a visualization.

---

## 10. Owner Control Room

Owner's workspace will contain:

### Ask Database

Natural-language database operations.

### Database Explorer

- Tables
- Views
- Functions
- Indexes
- Constraints

### Schema Management

Examples:

- Create table
- Alter table
- Add/remove column
- Create/drop index
- Create/drop view

### Activity / Audit

Record:

- Actor
- Role
- Time
- Operation
- Target
- Success/failure

### Database Health

Examples:

- Connection status
- Table count
- Row counts
- Recent failures
- Authorization status

### SQL Console

Advanced manual SQL entry for Owner.

The SQL Console is separate from the natural-language workflow.

---

## 11. Session Security

Current session behavior:

- Browser-session cookie.
- Closing the browser removes the session cookie.
- 30-minute inactivity timeout.
- Active sessions receive controlled heartbeat refreshes.
- Invalid/expired sessions return to login.

---

## 12. Existing UI/UX Changes

Already established:

- Light/dark theme toggle.
- Coordinated light and dark visual system.
- Member-specific read-only workspace.
- Post-login employee profile dashboard.
- Result view switching.
- SQL viewer.
- Responsive DataMind editorial/data-product interface.

The design should remain restrained and product-focused rather than becoming a generic dashboard or ChatGPT clone.

---

## 13. Security Architecture

DataMind uses defense in depth:

### Layer 1 — LLM prompt

Role-aware instructions.

Not a security boundary.

### Layer 2 — SQL validator

Independent server-side SQL safety checks.

### Layer 3 — Authorization layer

Role + employee hierarchy checks.

### Layer 4 — Database RPC/security functions

Final database-side authorization and execution boundary.

### Layer 5 — Server-only database credentials

Supabase secret/service-role credentials never reach the browser.

---

## 14. Database Safety Rules

The application must not:

- Trust employee names for destructive execution.
- Trust employee IDs supplied by the browser without re-validation.
- Allow Members to write.
- Allow Admins to modify authentication tables.
- Let the LLM decide authorization.
- Execute destructive operations automatically.
- Expose password hashes.
- Expose server-side database credentials.

---

## 15. Implementation Order

### Phase 1 — Target Resolution & Safe Admin Writes

1. Introduce target-resolution response types.
2. Resolve employee-name matches within Admin hierarchy.
3. Add single/multi-select target UI.
4. Re-validate selected employee IDs server-side.
5. Add affected-record preview.
6. Add final confirmation token/request.
7. Execute selected-target writes safely.
8. Handle multi-table deletion atomically where required.

### Phase 2 — Owner Authentication

1. Add `owner_users`.
2. Add Owner login verification.
3. Extend signed session role model.
4. Add Owner login panel.
5. Add Owner routing.

### Phase 3 — Owner Control Room

1. Ask Database.
2. Database Explorer.
3. Schema Management.
4. Activity/Audit.
5. Database Health.
6. SQL Console.

### Phase 4 — Owner Safety Boundary

1. Classify operations.
2. Validate Owner SQL.
3. Preview destructive actions.
4. Explicit confirmation.
5. Database permission checks.
6. Audit every Owner operation.

### Phase 5 — Final Testing

Test:

- Member self-access.
- Member unauthorized access.
- Admin hierarchy access.
- Admin outside-hierarchy rejection.
- Duplicate-name resolution.
- Single target selection.
- Multi-target selection.
- Destructive preview.
- Confirmation.
- Owner authentication.
- Owner DQL/DML/DDL/DCL behavior.
- Session timeout.
- Browser-close session behavior.
- Chart switching.
- Light/dark theme.
- SQL injection/prompt-injection attempts.

---

## 16. Final Product Model

```
                         DATAMIND
                            │
             ┌──────────────┼──────────────┐
             │              │              │
           OWNER          ADMIN          MEMBER
             │              │              │
       DB CONTROL       BUSINESS       SELF SERVICE
             │           CONTROL
             │              │
             └───────┬──────┘
                     │
              NATURAL LANGUAGE
                     │
                     ▼
              LLM INTERPRETATION
                     │
                     ▼
             SAFETY VALIDATION
                     │
              ┌──────┴──────┐
              │             │
        TARGET RESOLUTION  AUTHORIZATION
              │             │
              └──────┬──────┘
                     ▼
                 PostgreSQL
                     │
              ┌──────┼──────┐
              ▼      ▼      ▼
            TABLE  CHARTS  AUDIT
                   │
             BAR/LINE/PIE
```

## 17. Non-Goals

DataMind will not add unnecessary complexity such as:

- RAG
- Vector databases
- Embeddings
- Multi-agent systems
- Fine-tuning
- Fake/mock database answers
- Hardcoded query results
- Unnecessary microservices

The focus remains:

> **Natural language + real PostgreSQL + authorization + safe execution + explainable results.**
