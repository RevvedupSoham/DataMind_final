-- DataMind — one-time Supabase setup
--
-- Run this once in the Supabase SQL editor of your EXISTING project (the one
-- that already has the employee / department / salary / address /
-- job_history / dept_assignment tables). It does not create or modify any
-- application tables — it only adds a tightly-scoped, read-only execution
-- function that the app calls via `client.rpc("execute_readonly_sql", ...)`.
--
-- This function is a second, independent enforcement layer beyond the
-- application-level validator (lib/sql/validator.ts). Defense in depth:
-- the app never trusts a single layer to keep the database read-only.

create or replace function execute_readonly_sql(query text)
returns setof json
language plpgsql
security definer
set statement_timeout = '8s'
set search_path = public
as $$
begin
  -- Reject anything that isn't a single SELECT/WITH statement, independent
  -- of whatever validation already happened in the application layer.
  if query !~* '^\s*(select|with)(\s|$)' then
    raise exception 'Only read-only SELECT/WITH statements are allowed';
  end if;

  -- Reject an embedded second statement (a bare semicolon followed by more
  -- non-whitespace content), ignoring a single optional trailing semicolon.
  if regexp_replace(query, ';\s*$', '') ~ ';' then
    raise exception 'Multiple statements are not allowed';
  end if;

  return query execute format('select to_json(t) from (%s) t', query);
end;
$$;

-- Lock the function down: only the service role (used server-side only by
-- the app) may call it. Never grant this to `anon` or `authenticated`.
revoke all on function execute_readonly_sql(text) from public;
revoke all on function execute_readonly_sql(text) from anon;
revoke all on function execute_readonly_sql(text) from authenticated;
grant execute on function execute_readonly_sql(text) to service_role;

-- Optional but recommended extra hardening: run this function's queries as
-- a Postgres role that only has SELECT privileges on the application
-- tables, rather than relying solely on the guard clauses above. If you
-- have a dedicated read-only role (e.g. `readonly_executor`), you can
-- swap `security definer` to run as that role instead of the function
-- owner. This is optional and depends on your existing role setup.
