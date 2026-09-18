-- DataMind — auth & role-based access setup
--
-- Run this once in the Supabase SQL editor, AFTER setup.sql. It adds:
--   1. TWO SEPARATE login tables: admin_users and member_users. There is no
--      shared "app_users" table and no role column to compare — the
--      Admin panel only ever reads admin_users, and the Member panel only
--      ever reads member_users. A member account cannot be authenticated
--      by the admin check, and an admin account cannot be authenticated by
--      the member check, because each check literally never queries the
--      other table.
--   2. verify_admin_login / verify_member_login — one function per table,
--      each returning true/false for that table only.
--   3. execute_privileged_sql — allows DDL/DML for admin-initiated
--      requests. This is called ONLY after the app has independently
--      verified, from a signed session cookie, that the caller passed
--      verify_admin_login — never from a client-supplied role.
--
-- Passwords are hashed with pgcrypto's bcrypt (`crypt()` / `gen_salt('bf')`)
-- so a raw password is never stored, and comparison happens inside
-- Postgres — the plaintext password is only ever sent from the browser to
-- the matching server-side RPC call, once, over TLS.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Two independent tables. Deliberately NOT unified with a role column —
-- the whole point is that the Admin panel's query has no code path that
-- can ever touch member_users, and vice versa.
-- ---------------------------------------------------------------------

create table if not exists admin_users (
  id bigint generated always as identity primary key,
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists member_users (
  id bigint generated always as identity primary key,
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- Lock both tables down completely from the client-side anon/authenticated
-- roles. DataMind only ever talks to these tables through the RPC
-- functions below, called with the service-role key from the server.
revoke all on table admin_users from public, anon, authenticated;
revoke all on table member_users from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Seed one demo account per table. CHANGE THESE PASSWORDS before
-- deploying beyond a local demo — this file is meant to be readable, not
-- production-secret.
-- ---------------------------------------------------------------------
insert into admin_users (username, password_hash)
values ('admin', crypt('change-me-admin', gen_salt('bf')))
on conflict (username) do nothing;

insert into member_users (username, password_hash)
values ('member', crypt('change-me-member', gen_salt('bf')))
on conflict (username) do nothing;

-- ---------------------------------------------------------------------
-- verify_admin_login: the ONLY way DataMind checks an admin password.
-- Queries admin_users ONLY. Returns true on success, false otherwise.
-- Never raises with details that would reveal whether the username
-- exists (avoids username-enumeration via error messages/timing).
-- ---------------------------------------------------------------------
create or replace function verify_admin_login(p_username text, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_match boolean;
begin
  select exists (
    select 1
    from admin_users
    where username = p_username
      and password_hash = crypt(p_password, password_hash)
  ) into v_match;

  return v_match;
end;
$$;

revoke all on function verify_admin_login(text, text) from public, anon, authenticated;
grant execute on function verify_admin_login(text, text) to service_role;

-- ---------------------------------------------------------------------
-- verify_member_login: the ONLY way DataMind checks a member password.
-- Queries member_users ONLY.
-- ---------------------------------------------------------------------
create or replace function verify_member_login(p_username text, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_match boolean;
begin
  select exists (
    select 1
    from member_users
    where username = p_username
      and password_hash = crypt(p_password, password_hash)
  ) into v_match;

  return v_match;
end;
$$;

revoke all on function verify_member_login(text, text) from public, anon, authenticated;
grant execute on function verify_member_login(text, text) to service_role;

-- ---------------------------------------------------------------------
-- execute_privileged_sql: like execute_readonly_sql (setup.sql), but also
-- allows INSERT / UPDATE / DELETE / CREATE / DROP / ALTER / TRUNCATE.
--
-- Still permanently blocks, for every caller regardless of panel:
--   - multiple statements
--   - GRANT / REVOKE / MERGE / CALL / EXECUTE (privilege escalation /
--     arbitrary procedure execution)
--   - VACUUM / COPY / LISTEN / NOTIFY / SET / COMMENT (server-admin ops
--     with no legitimate place in an NL-to-SQL data tool)
--   - the same restricted pg_* / dblink_* function list as the read-only
--     path
--
-- The application (app/api/query/route.ts) only calls this function AFTER
-- verifying, from the signed session cookie, that the request came from a
-- session created via verify_admin_login. This function does not and
-- cannot check that itself — it is a data-layer guard, not the
-- authorization boundary. Treat it as "powerful and trusted-caller-only",
-- not "safe to expose broadly".
-- ---------------------------------------------------------------------
create or replace function execute_privileged_sql(query text)
returns setof json
language plpgsql
security definer
set statement_timeout = '15s'
set search_path = public
as $$
begin
  if query ~* '\y(grant|revoke|merge|call|execute|vacuum|copy|listen|notify|comment)\y' then
    raise exception 'This operation is not permitted, even for admin accounts';
  end if;

  if query ~* '\y(pg_read_file|pg_ls_dir|pg_reload_conf|lo_import|lo_export|dblink_exec|pg_terminate_backend|pg_cancel_backend)\y' then
    raise exception 'Use of a restricted database function was detected';
  end if;

  if query !~* '^\s*(select|with|insert|update|delete|create|drop|alter|truncate)(\s|$)' then
    raise exception 'Unrecognized or disallowed statement type';
  end if;

  if regexp_replace(query, ';\s*$', '') ~ ';' then
    raise exception 'Multiple statements are not allowed';
  end if;

  -- SELECT/WITH still return rows via to_json; DDL/DML statements return
  -- no result set, so we run them directly and return an empty set.
  if query ~* '^\s*(select|with)(\s|$)' then
    return query execute format('select to_json(t) from (%s) t', query);
  else
    execute query;
    return;
  end if;
end;
$$;

revoke all on function execute_privileged_sql(text) from public, anon, authenticated;
grant execute on function execute_privileged_sql(text) to service_role;

comment on function execute_privileged_sql(text) is
  'DataMind: executes admin-authorized SQL, including DDL/DML. Callable only by service_role, and only ever invoked server-side after the caller''s session was created via verify_admin_login.';
