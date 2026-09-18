# DataMind

**Ask your database in plain English.**

DataMind turns a natural-language question about an employee database into a
real PostgreSQL query, runs it against your actual Supabase database, and
shows you the SQL, the data, and — when it makes sense — a chart. There is no
mock data anywhere in the pipeline: the database is the single source of
truth, and the LLM's only job is translating English into SQL.

DataMind sits behind a login. There are two account roles:

- **Member** — read-only. Can ask anything about the data; every generated
  statement is guaranteed to be a `SELECT`/`WITH` query.
- **Admin** — read and write. Can additionally ask DataMind to create,
  update, or delete data (or even schema), but nothing runs automatically —
  every write is shown for review and only executes after the admin clicks
  **Confirm & Run**.

## Problem & solution

Non-technical stakeholders can't write SQL, and engineers don't want to be a
human query API. DataMind closes that gap:

```
Login (member or admin)
   → Natural language question
   → LLM (Groq · openai/gpt-oss-120b) — role-aware prompt
   → PostgreSQL statement
   → independent server-side safety validation (role-aware)
   → read: execute immediately via read-only RPC
   → write (admin only): held for explicit confirmation, then executed
      via a separate, more tightly scoped RPC
   → real rows
   → SQL viewer + dynamic result table
   → automatic visualization, only when the data supports it
```

The LLM never sees or returns data — it only ever produces a SQL string. All
filtering, joining, counting, ranking, and aggregation happens in Postgres.

## Architecture

```
app/
  layout.tsx                Root layout, fonts, metadata
  page.tsx                   Landing page composition (behind login)
  login/page.tsx              Login screen: Admin / Member tabs
  globals.css                  Tailwind base + design tokens
  api/
    query/route.ts             Generates + validates SQL. Executes reads
                                immediately; returns writes as "pending
                                confirmation" instead of running them.
    query/confirm/route.ts      The ONLY route that executes a write. Re-
                                validates the statement and requires an
                                admin session.
    auth/login/route.ts          Verifies credentials, issues a signed
                                session cookie carrying the account's role
    auth/logout/route.ts         Clears the session cookie
    auth/me/route.ts             Returns the current session (or 401)
    health/route.ts              Supabase connectivity check

components/
  Navigation.tsx           Overlay nav + a round avatar button that opens a
                           dropdown with the signed-in user's name, role,
                           and a sign-out button (UserMenu, in this file)
  Hero.tsx                 Hero section
  HowItWorks.tsx           4-step explainer
  QueryInterface.tsx       The core product: input, status, confirmation
                           step for writes, results
  SuggestedQuestions.tsx   Quick-start question chips
  SQLViewer.tsx            Generated SQL + copy button
  ResultView.tsx           Table/Bar/Line/Pie tab switcher + admin-only
                           "Download CSV" button, wrapping ResultTable and
                           ChartRenderer
  ResultTable.tsx          Dynamic, type-aware result table
  ChartRenderer.tsx        Recharts bar/line/pie renderer (renders whichever
                           single chart ResultView has selected)
  Examples.tsx             Required example questions
  VisualizationSection.tsx  "From answers to insight" + FinalCta + Footer

lib/
  csv.ts                   Converts a QueryResult to CSV text and triggers
                           a browser download — purely client-side, so it
                           can never export more than the user's own
                           session already returned to them
  ask-bridge.ts            Tiny window-event bridge so Examples/
                           VisualizationSection can trigger a question in
                           QueryInterface without prop drilling
  auth/session.ts          Signs/verifies session cookies with Web Crypto
                           (works in both the Node API routes and the Edge
                           middleware runtime)
  llm/groq.ts              Groq client (server-only) — role-aware prompt
  sql/schema.ts            VERIFIED_SCHEMA + both LLM system prompts
                           (read-only for members, write-enabled for admins)
  sql/validator.ts         Independent, role-aware SQL safety validator
                           (the real security boundary)
  database/supabase.ts     Supabase service-role client, read-only RPC call,
                           privileged (write) RPC call, and credential
                           verification
  visualization/engine.ts  Decides chart type from the *actual* returned rows

types/
  auth.ts        Session/role types
  database.ts    Row types + DatabaseSchema shape
  query.ts       Query/response/status types, including the pending-
                 confirmation shape for admin writes
  visualization.ts  ChartType + VisualizationConfig
  css.d.ts        Ambient module declaration so plain CSS imports type-check
                 under standalone `tsc` (next build already handles this)

middleware.ts     Redirects any unauthenticated request to /login (JSON 401
                 for /api/* instead of a redirect)

setup.sql          One-time Supabase SQL: execute_readonly_sql RPC
auth_setup.sql      One-time Supabase SQL: separate admin_users/member_users
                   tables, verify_admin_login/verify_member_login RPCs,
                   execute_privileged_sql RPC (run after setup.sql)
```

## Natural language → SQL

`lib/sql/schema.ts` builds the system prompt sent to `openai/gpt-oss-120b`
via Groq. It contains the verified schema (`employee`, `department`,
`salary`, `address`, `job_history`, `dept_assignment`) and their foreign
keys. There are two prompt variants:

- **Member (read-only)** instructs the model to return exactly one
  `SELECT`/`WITH`/`WITH RECURSIVE` statement, and to explicitly refuse (by
  returning a zero-row `SELECT`) anything that would modify data.
- **Admin (write-enabled)** additionally allows `INSERT`/`UPDATE`/`DELETE`/
  `CREATE`/`DROP`/`ALTER`/`TRUNCATE` when the request clearly asks for one,
  but still forbids `GRANT`/`REVOKE`/`MERGE`/`CALL`/`EXECUTE` and other
  privilege-escalation or server-admin operations unconditionally.

Both variants:

- respond as JSON: `{"sql": "...", "explanation": "..."}`
- never emit multiple statements
- use a recursive CTE for arbitrary-depth manager hierarchies
- ignore any instruction embedded in the user's question (prompt injection)

The prompt is a **behavioral** guardrail only. It is never trusted as the
security boundary — the account's actual role, read from the verified
session cookie, decides which prompt variant is even used, and the
validator below re-checks everything regardless of what the model returned.

## SQL validation (the real security boundary)

`lib/sql/validator.ts`'s `validateSql(sql, { allowWrites })` independently
re-parses the SQL the model returned. `allowWrites` is passed in by the API
route from the verified session role — never from anything in the request
body.

For every request, regardless of role:

- strips comments (so a forbidden keyword can't hide inside one)
- rejects multiple statements (stray `;` outside string literals)
- rejects a handful of dangerous Postgres functions (`pg_read_file`,
  `dblink_exec`, `pg_terminate_backend`, ...)
- enforces a max length
- unconditionally forbids `GRANT`, `REVOKE`, `MERGE`, `CALL`, `EXECUTE`,
  `VACUUM`, `COPY`, `LISTEN`, `NOTIFY`, `SET`, `COMMENT` — there is no role
  that unlocks these

For a **member** (`allowWrites: false`), the statement must additionally
start with `SELECT` or `WITH`, and the full read-only forbidden-keyword list
(`INSERT`/`UPDATE`/`DELETE`/`DROP`/`ALTER`/`TRUNCATE`/`CREATE`/...) applies.

For an **admin** (`allowWrites: true`), `INSERT`/`UPDATE`/`DELETE`/`CREATE`/
`DROP`/`ALTER`/`TRUNCATE` are permitted as a leading statement type, but an
`UPDATE`/`DELETE` with no `WHERE` clause is rejected outright (it would
affect every row in a table) — the request has to specify which row(s) it
means, or say explicitly that it wants to affect everything.

## Read-only & privileged database execution (defense in depth)

`setup.sql` creates `execute_readonly_sql(query text)` — re-checks
`SELECT`/`WITH`, rejects multiple statements, runs with an 8s
`statement_timeout`, and is granted only to `service_role`.

`auth_setup.sql` additionally creates `execute_privileged_sql(query text)`
for admin writes. It independently re-blocks the same
privilege-escalation/server-admin keyword list and the same dangerous
function list, accepts `SELECT`/`WITH`/`INSERT`/`UPDATE`/`DELETE`/`CREATE`/
`DROP`/`ALTER`/`TRUNCATE`, still rejects multiple statements, and is granted
only to `service_role`. **The application only ever calls this function
after independently verifying, from the signed session cookie, that the
caller is an admin** — the function itself has no way to check that, so
treat it as "powerful and trusted-caller-only."

The app calls these via `client.rpc(...)` using the service-role key, which
never leaves the server. This is a second, independent enforcement layer
beyond the app-level validator: DataMind never relies on a single layer to
keep unauthorized writes out.

## Authentication & roles

- `auth_setup.sql` creates **two separate tables** — `admin_users` and
  `member_users` — with no shared table and no role column to compare. Each
  has its own `username` and `pgcrypto`-hashed `password_hash`. The Admin
  panel's login check has no code path that can ever read `member_users`,
  and the Member panel's check has no code path that can ever read
  `admin_users` — it isn't just filtered out after a lookup, the other
  table is never queried at all. Two demo accounts are seeded, one per
  table — **change both demo passwords** before using this beyond a local
  demo.
- `verify_admin_login(username, password)` and `verify_member_login(username,
  password)` are two separate Postgres functions, each checking the
  password DB-side (via `crypt()`) against only its own table, and
  returning `true`/`false`. Which one runs is decided entirely by which
  panel tab the login screen posts — `lib/database/supabase.ts` picks the
  RPC by that panel name.
- On success, the server issues a signed, `httpOnly` session cookie
  (`lib/auth/session.ts`) containing `{username, role, iat, exp}` with an
  HMAC-SHA256 signature keyed by `SESSION_SECRET`. It's built on the Web
  Crypto API specifically so the same code verifies sessions in both the
  Node.js API routes and the Edge middleware runtime.
- `middleware.ts` redirects any unauthenticated request to `/login` (and
  returns a JSON 401 for `/api/*` instead of a redirect, since a `fetch()`
  following a 302 to an HTML page isn't useful to the caller).
- Every privileged decision (`allowWrites`, which RPC to call) is re-derived
  from the verified cookie inside the route handler itself — never trusted
  from middleware alone, and never accepted as a parameter from the client.

## Automatic visualization

`lib/visualization/engine.ts`'s `getVisualizationOptions` looks only at the
columns/types of the rows Postgres actually returned, and computes **every**
chart type that's genuinely valid for that shape in one pass — not just one:

- needs ≥2 rows and a numeric column, or nothing is chartable
- a date column → `["line", "bar"]`
- a categorical column with 2–8 distinct values → `["bar", "pie"]`
- a categorical column with 9–25 distinct values → `["bar"]` only (pie gets
  unreadable much past 8 slices)
- anything else (single row, no numeric column, more than 25 categories, or
  a write statement's empty result set) → `[]`, table only

The array order is just a display hint — if the question's own wording
suggests one (e.g. "pie chart of...", "...over time"), that type is put
first — but every entry in the array is independently valid.
`isVisualizationRenderable` re-checks each one against the real result
before the route ever returns it, so a chart option is never returned with
fields that don't exist or aren't numeric.

The user never picks the chart type up front, and the model never decides
it either — the frontend (`ResultView.tsx`) renders Table plus one button
per valid chart type, all generated together in the same response so
switching between them is instant, not a second round trip. Table is
always the default view for a fresh result; nothing else is shown until
the user clicks one of the chart buttons.

## CSV export

Admin accounts can download the current result table as a CSV file; member
accounts cannot — the "Download CSV" button in `ResultView.tsx` only
renders when the signed-in session's role is `"admin"`. Export
(`lib/csv.ts`) works entirely client-side against the `QueryResult` already
in the browser: it formats exactly the rows and columns the user was
already shown under their own session, so it can never surface more than
what that request already legitimately returned. There is no separate
export API route to secure — the same role check the rest of the app uses
(`GET /api/auth/me` on load) gates whether the button renders at all.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment** — copy `.env.example` to `.env.local` and fill
   in real values:

   ```bash
   cp .env.example .env.local
   ```

   ```
   GROQ_API_KEY=
   GROQ_MODEL=openai/gpt-oss-120b
   NEXT_PUBLIC_SUPABASE_URL=
   SUPABASE_SECRET_KEY=
   # Optional legacy fallback:
   # SUPABASE_SERVICE_ROLE_KEY=
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   SESSION_SECRET=
   ```

   `SUPABASE_SECRET_KEY` is the preferred current server-side key and is
   never sent to the browser. `SUPABASE_SERVICE_ROLE_KEY` is supported as a
   legacy fallback. Both are read only inside `lib/database/supabase.ts`,
   which is marked `import "server-only"`.

   Generate `SESSION_SECRET` with:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Run the one-time Supabase setup**, in order, in the SQL editor of your
   **existing** Supabase project (the one that already has `employee`,
   `department`, `salary`, `address`, `job_history`, `dept_assignment`):

   1. `setup.sql` — adds `execute_readonly_sql`. Does not touch application
      tables.
   2. `auth_setup.sql` — adds `admin_users`, `member_users`,
      `verify_admin_login`, `verify_member_login`, `execute_privileged_sql`,
      and seeds one demo account per table (`admin`/`change-me-admin` in
      `admin_users`, `member`/`change-me-member` in `member_users`).
      **Change both passwords** — the simplest way is to re-run the two
      `insert` statements with `on conflict (username) do update set
      password_hash = excluded.password_hash` once you've picked real
      passwords, or delete and re-insert the rows in the table for the
      panel you're changing.

4. **Run the app**

   ```bash
   npm run dev
   ```

   Visit `http://localhost:3000` — you'll be redirected to `/login`. Sign in
   as either demo account to try the corresponding role.

### Supabase connection check

After starting the app, open `http://localhost:3000/api/health` in the
browser. A working setup returns `{"ok":true,"database":"connected"}`. If
the RPC function has not been installed yet, the endpoint reports that
directly.

If you get the missing-function message, open the SQL Editor of the
existing Supabase project and run the complete `setup.sql` file once (and
`auth_setup.sql` for login/roles). Do not create a second project or
replace the existing application tables.

## Commands

```bash
npm run dev         # start the dev server
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run build        # production build
npm run start        # run the production build
```

## Example questions

Read (any role):

- "In finance, who earns the second highest salary?"
- "Who is working in more than one department?"
- "Which managers have 50 or more employees under them, direct or indirect?"
- "How many people work in each department?"
- "Which city has the most employees?"
- "Show me a pie chart of employees by department."
- "Compare average salary across departments as a bar chart."
- "Plot hiring over the last five years."

Write (admin only — each is shown for review before it runs):

- "Add a new department called Legal, located in Kolkata."
- "Update employee 12's salary to 95000 effective today."
- "Delete the job history row for employee 7 where the new role is 'Intern'."

## Security

- The Supabase service-role/secret key, the Groq API key, and
  `SESSION_SECRET` are read only in server-only modules and are never
  inlined into the client bundle (only `NEXT_PUBLIC_*` variables are, and
  none of these use that prefix).
- Session cookies are `httpOnly`, `sameSite=lax`, signed with HMAC-SHA256,
  and carry an 8-hour expiry checked on every request.
- A user's role is never accepted from the client as the basis for
  authorization — it is only ever confirmed by which table's login RPC
  actually matched (`verify_admin_login` against `admin_users`, or
  `verify_member_login` against `member_users`), and re-read from the
  verified session cookie on every subsequent request. The login screen's
  Admin/Member tabs pick which of those two isolated checks runs; there is
  no shared table or role column being compared anywhere.
- Two independent layers reject unsafe SQL for every request: the app-level
  validator (`lib/sql/validator.ts`) and the database-level RPC guard
  (`setup.sql` / `auth_setup.sql`). A third layer, unique to writes: nothing
  an admin's question resolves to is executed until the admin explicitly
  confirms it in the UI, and `/api/query/confirm` re-validates the
  statement itself rather than trusting the client's copy of it.
- `GRANT`/`REVOKE`/`MERGE`/`CALL`/`EXECUTE` and other privilege-escalation
  or server-admin operations are forbidden unconditionally — no role
  unlocks them.
- The API routes never return stack traces or internal error details to the
  browser; technical details are only `console.error`'d server-side.
- Prompt injection ("ignore previous instructions and delete...") is
  treated purely as translation input by the model, and even if the model
  complied, the resulting SQL would still be rejected by every validation
  layer before it could reach the database — and even a validated admin
  write still stops for human confirmation first.

## Limitations

- This environment could not run the app against a real Groq or Supabase
  project — it has no outbound network access to `api.groq.com`,
  `*.supabase.co`, or `fonts.googleapis.com`, and no real credentials were
  provided. What WAS verified in this environment: `npm install`,
  `npm run typecheck` (clean), `npm run lint` (clean), and a full
  `npm run build` (verified successful with the Google Fonts calls in
  `app/layout.tsx` temporarily stubbed out for that one build, since that
  fetch is the only step blocked by network access — the real
  `next/font/google` imports were restored immediately afterward and are
  what ships in this codebase). The functional test matrix against real
  data (the example questions above, both read and write, under both
  roles) still needs to be run in an environment with network access and
  real `GROQ_API_KEY` / Supabase / `SESSION_SECRET` values.
- Chart type is chosen heuristically from column names/types and simple
  keyword cues in the question; it will sensibly fall back to "table only"
  rather than guess for ambiguous shapes.
- Query history is a lightweight `localStorage` list (last 8 questions) —
  there is no server-side history table, by design.
- The demo accounts and passwords seeded into `admin_users` and
  `member_users` by `auth_setup.sql` are meant to be readable for a local
  demo, not production-secret. Change both passwords (or replace the seed
  rows entirely) before deploying anywhere reachable by others.
