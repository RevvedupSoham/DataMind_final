-- DataMind — auth & role-based access setup with employee-level authorization
--
-- Run this once in the Supabase SQL editor, AFTER setup.sql. It adds:
--   1. TWO SEPARATE login tables: admin_users and member_users, each now
--      with an employee_id that links the user to an employee record.
--   2. verify_admin_login / verify_member_login — returns employee_id on success
--   3. Authorization helper functions for hierarchy-based and self-only access
--   4. execute_authorized_sql — enforces row-level authorization policies
--   5. execute_privileged_sql — for admin writes (still requires authorization checks)
--
-- Passwords are hashed with pgcrypto's bcrypt (`crypt()` / `gen_salt('bf')`).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Two independent tables with employee_id mapping
-- ---------------------------------------------------------------------

-- Drop and recreate to add employee_id column
drop table if exists admin_users cascade;
create table admin_users (
  id bigint generated always as identity primary key,
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now(),
  employee_id int4 references employee(id) on delete set null
);

drop table if exists member_users cascade;
create table member_users (
  id bigint generated always as identity primary key,
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now(),
  employee_id int4 references employee(id) on delete set null
);

-- Lock both tables down completely
revoke all on table admin_users from public, anon, authenticated;
revoke all on table member_users from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Seed accounts with employee mapping
-- For demo purposes - link admin to employee 1, member to employee 2
-- CHANGE THESE in production
-- ---------------------------------------------------------------------
insert into admin_users (username, password_hash, employee_id)
values ('admin', crypt('change-me-admin', gen_salt('bf')), 1)
on conflict (username) do nothing;

insert into member_users (username, password_hash, employee_id)
values ('member', crypt('change-me-member', gen_salt('bf')), 2)
on conflict (username) do nothing;

-- ---------------------------------------------------------------------
-- verify_admin_login: Returns employee_id on success, NULL on failure
-- ---------------------------------------------------------------------
-- Dropped first: older installs of this function returned `boolean`,
-- and Postgres refuses CREATE OR REPLACE when the return type changes.
drop function if exists verify_admin_login(text, text);

create or replace function verify_admin_login(p_username text, p_password text)
returns int4
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee_id int4;
begin
  select employee_id into v_employee_id
  from admin_users
  where username = p_username
    and password_hash = crypt(p_password, password_hash);
  
  return v_employee_id;
end;
$$;

revoke all on function verify_admin_login(text, text) from public, anon, authenticated;
grant execute on function verify_admin_login(text, text) to service_role;

-- ---------------------------------------------------------------------
-- verify_member_login: Returns employee_id on success, NULL on failure
-- ---------------------------------------------------------------------
-- Dropped first: older installs of this function returned `boolean`,
-- and Postgres refuses CREATE OR REPLACE when the return type changes.
drop function if exists verify_member_login(text, text);

create or replace function verify_member_login(p_username text, p_password text)
returns int4
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee_id int4;
begin
  select employee_id into v_employee_id
  from member_users
  where username = p_username
    and password_hash = crypt(p_password, password_hash);
  
  return v_employee_id;
end;
$$;

revoke all on function verify_member_login(text, text) from public, anon, authenticated;
grant execute on function verify_member_login(text, text) to service_role;

-- ---------------------------------------------------------------------
-- get_hierarchy: Returns all employee IDs in an admin's reporting hierarchy
-- Includes: self, direct reports, indirect reports (unlimited depth)
-- WITH cycle protection
-- ---------------------------------------------------------------------
drop function if exists get_hierarchy(int4);

create or replace function get_hierarchy(p_employee_id int4)
returns table(employee_id int4)
language sql
stable
as $$
  with recursive hierarchy as (
    -- Base case: the manager themselves
    select id as employee_id, array[id] as path
    from employee
    where id = p_employee_id
    
    union
    
    -- Recursive case: direct and indirect reports
    select e.id, h.path || e.id
    from employee e
    inner join hierarchy h on e.manager_id = h.employee_id
    where not (e.id = any(h.path))  -- cycle protection
  )
  select employee_id from hierarchy;
$$;

revoke all on function get_hierarchy(int4) from public, anon, authenticated;
grant execute on function get_hierarchy(int4) to service_role;

-- ---------------------------------------------------------------------
-- check_query_authorization: Validates if a query is authorized
-- Returns: {authorized: boolean, reason: text, modified_sql: text}
-- This function analyzes the query and enforces access policies
-- ---------------------------------------------------------------------
drop function if exists check_query_authorization(text, text, int4);

create or replace function check_query_authorization(
  p_sql text,
  p_role text,
  p_employee_id int4
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_sql_lower text;
  v_has_employee boolean;
  v_has_salary boolean;
  v_has_address boolean;
  v_has_job_history boolean;
  v_is_aggregate boolean;
  v_has_where boolean;
begin
  -- Normalize SQL for analysis
  v_sql_lower := lower(trim(p_sql));
  
  -- Check if query accesses specific tables
  v_has_employee := v_sql_lower ~ '\bemployee\b';
  v_has_salary := v_sql_lower ~ '\bsalary\b';
  v_has_address := v_sql_lower ~ '\baddress\b';
  v_has_job_history := v_sql_lower ~ '\bjob_history\b';
  
  -- Check if it's an aggregate query (has COUNT, SUM, AVG, etc. without individual employee.id in SELECT)
  v_is_aggregate := (
    v_sql_lower ~ '\b(count|sum|avg|max|min|group\s+by)\b' 
    and not v_sql_lower ~ 'select\s+.*\bemployee\.id\b'
  );
  
  -- Check if query has WHERE clause
  v_has_where := v_sql_lower ~ '\bwhere\b';
  
  -- MEMBER authorization (POLICY 1, 2, 8)
  if p_role = 'member' then
    -- Members can only see their own individual data
    if v_has_employee or v_has_salary or v_has_address or v_has_job_history then
      if v_is_aggregate then
        -- POLICY 2: Limited aggregate access (allow counts, general queries)
        -- Reject salary aggregates specifically
        if v_has_salary and v_sql_lower ~ '\b(sum|avg|max|min)\s*\(\s*.*\bamount\b' then
          return jsonb_build_object(
            'authorized', false,
            'reason', 'Members cannot access salary statistics. This query requires admin access.'
          );
        end if;
        -- Allow other aggregates (counts, department stats, etc.)
        return jsonb_build_object('authorized', true, 'modified_sql', p_sql);
      else
        -- Individual access must contain the authenticated employee ID.
        -- DataMind uses custom authentication, so Supabase auth.uid() is not
        -- available here. The verified session employee_id is passed into this
        -- security-definer RPC and must appear in the generated SQL.
        if not v_has_where then
          return jsonb_build_object(
            'authorized', false,
            'reason', 'Members can only access their own employee information.'
          );
        end if;

        if not (
          v_sql_lower ~ ('employee\\.id\\s*=\\s*' || p_employee_id || '\\y')
          or v_sql_lower ~ ('salary\\.employee_id\\s*=\\s*' || p_employee_id || '\\y')
          or v_sql_lower ~ ('address\\.employee_id\\s*=\\s*' || p_employee_id || '\\y')
          or v_sql_lower ~ ('job_history\\.employee_id\\s*=\\s*' || p_employee_id || '\\y')
          or v_sql_lower ~ ('dept_assignment\\.employee_id\\s*=\\s*' || p_employee_id || '\\y')
        ) then
          return jsonb_build_object(
            'authorized', false,
            'reason', 'Members can only access records belonging to their own employee account.'
          );
        end if;

        return jsonb_build_object('authorized', true, 'modified_sql', p_sql);
      end if;
    end if;
    
    -- Default: allow (for department metadata, etc.)
    return jsonb_build_object('authorized', true, 'modified_sql', p_sql);
  end if;
  
  -- ADMIN authorization (POLICY 3, 4, 5, 6, 7)
  if p_role = 'admin' then
    -- Admins have hierarchy-based access
    -- For individual queries, we don't auto-inject filters (POLICY 10)
    -- But we allow the query and rely on app-level hierarchy enforcement
    
    if v_has_salary or v_has_address or v_has_job_history then
      if not v_is_aggregate and not v_has_where then
        return jsonb_build_object(
          'authorized', false,
          'reason', 'Admin access to sensitive data (salary, address, job history) requires specifying which employees. Add a WHERE clause.'
        );
      end if;
    end if;
    
    -- POLICY 6: job_history.old_role is restricted even for admins
    if v_has_job_history and v_sql_lower ~ 'select\s+.*\bold_role\b' then
      return jsonb_build_object(
        'authorized', false,
        'reason', 'The old_role field in job_history is restricted. You can access new_role and changed_on only.'
      );
    end if;
    
    -- Sensitive admin reads must be scoped to the authenticated hierarchy.
    if v_has_salary or v_has_address or v_has_job_history then
      if not (
        v_sql_lower ~ ('get_hierarchy\\s*\\(\\s*' || p_employee_id || '\\s*\\)')
        or v_sql_lower ~ ('employee\\.id\\s*=\\s*' || p_employee_id || '\\y')
        or v_sql_lower ~ ('employee\\.id\\s+in\\s*\\(.*get_hierarchy')
        or v_sql_lower ~ ('salary\\.employee_id\\s*=\\s*' || p_employee_id || '\\y')
        or v_sql_lower ~ ('address\\.employee_id\\s*=\\s*' || p_employee_id || '\\y')
        or v_sql_lower ~ ('job_history\\.employee_id\\s*=\\s*' || p_employee_id || '\\y')
      ) then
        return jsonb_build_object(
          'authorized', false,
          'reason', 'Admin access must be restricted to the authenticated employee hierarchy.'
        );
      end if;
    end if;

    return jsonb_build_object('authorized', true, 'modified_sql', p_sql);
  end if;
  
  -- Unknown role
  return jsonb_build_object(
    'authorized', false,
    'reason', 'Unknown role. Authorization check failed.'
  );
end;
$$;

revoke all on function check_query_authorization(text, text, int4) from public, anon, authenticated;
grant execute on function check_query_authorization(text, text, int4) to service_role;

-- ---------------------------------------------------------------------
-- execute_authorized_sql: Executes read-only SQL with authorization checks
-- This replaces execute_readonly_sql for authorized queries
-- ---------------------------------------------------------------------
drop function if exists execute_authorized_sql(text, text, int4);

create or replace function execute_authorized_sql(
  p_sql text,
  p_role text,
  p_employee_id int4
)
returns setof json
language plpgsql
security definer
set statement_timeout = '8s'
set search_path = public
as $$
declare
  v_auth_result jsonb;
  v_final_sql text;
begin
  -- Basic SQL safety (same as execute_readonly_sql)
  if p_sql !~* '^\s*(select|with)(\s|$)' then
    raise exception 'Only read-only SELECT/WITH statements are allowed';
  end if;

  if regexp_replace(p_sql, ';\s*$', '') ~ ';' then
    raise exception 'Multiple statements are not allowed';
  end if;
  
  -- Authorization check
  v_auth_result := check_query_authorization(p_sql, p_role, p_employee_id);
  
  if not (v_auth_result->>'authorized')::boolean then
    raise exception '%', v_auth_result->>'reason';
  end if;
  
  v_final_sql := v_auth_result->>'modified_sql';
  
  -- Execute the authorized query
  return query execute format('select to_json(t) from (%s) t', v_final_sql);
end;
$$;

revoke all on function execute_authorized_sql(text, text, int4) from public, anon, authenticated;
grant execute on function execute_authorized_sql(text, text, int4) to service_role;

-- ---------------------------------------------------------------------
-- execute_privileged_sql: Admin writes (with authorization enforcement)
-- ---------------------------------------------------------------------
drop function if exists execute_privileged_sql(text, text, int4);

create or replace function execute_privileged_sql(
  p_sql text,
  p_role text,
  p_employee_id int4
)
returns setof json
language plpgsql
security definer
set statement_timeout = '15s'
set search_path = public
as $$
declare
  v_auth_result jsonb;
  v_final_sql text;
begin
  -- Only admins can write
  if p_role != 'admin' then
    raise exception 'Write operations require admin access';
  end if;

  -- SQL safety checks
  if p_sql ~* '\y(grant|revoke|merge|call|execute|vacuum|copy|listen|notify|comment)\y' then
    raise exception 'This operation is not permitted, even for admin accounts';
  end if;

  if p_sql ~* '\y(pg_read_file|pg_ls_dir|pg_reload_conf|lo_import|lo_export|dblink_exec|pg_terminate_backend|pg_cancel_backend)\y' then
    raise exception 'Use of a restricted database function was detected';
  end if;

  if p_sql !~* '^\s*(select|with|insert|update|delete|create|drop|alter|truncate)(\s|$)' then
    raise exception 'Unrecognized or disallowed statement type';
  end if;

  if regexp_replace(p_sql, ';\s*$', '') ~ ';' then
    raise exception 'Multiple statements are not allowed';
  end if;

  -- Block writes to auth tables
  if p_sql ~* '\b(admin_users|member_users)\b' then
    raise exception 'Authentication tables cannot be modified through DataMind';
  end if;

  -- Authorization check for reads
  if p_sql ~* '^\s*(select|with)(\s|$)' then
    v_auth_result := check_query_authorization(p_sql, p_role, p_employee_id);
    if not (v_auth_result->>'authorized')::boolean then
      raise exception '%', v_auth_result->>'reason';
    end if;
    v_final_sql := v_auth_result->>'modified_sql';
    return query execute format('select to_json(t) from (%s) t', v_final_sql);
  else
    -- For writes, we execute without auto-modification
    -- The application layer must ensure writes are authorized
    execute p_sql;
    return;
  end if;
end;
$$;

revoke all on function execute_privileged_sql(text, text, int4) from public, anon, authenticated;
grant execute on function execute_privileged_sql(text, text, int4) to service_role;

comment on function execute_privileged_sql(text, text, int4) is
  'DataMind: executes admin-authorized SQL with employee-level access control';
