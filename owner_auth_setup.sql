-- =====================================================
-- DataMind OWNER Authentication Foundation
-- =====================================================
-- Purpose:
-- Introduce isolated OWNER authentication independent
-- from employee hierarchy authentication.
-- =====================================================

create extension if not exists pgcrypto;

create table if not exists owner_users (
    id uuid primary key default gen_random_uuid(),
    username text not null unique,
    password_hash text not null,
    display_name text not null,
    created_at timestamptz not null default now()
);

comment on table owner_users is
'Platform-level OWNER accounts for database administration.';

comment on column owner_users.password_hash is
'Argon2/Bcrypt password hash. Never plaintext.';

create index if not exists idx_owner_users_username
on owner_users(username);

-- =====================================================
-- OWNER audit infrastructure foundation
-- =====================================================

create table if not exists audit_logs (
    id uuid primary key default gen_random_uuid(),
    actor_username text not null,
    actor_role text not null,
    operation_type text not null,
    operation_target text,
    execution_status text not null,
    affected_rows integer,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_created_at
on audit_logs(created_at desc);

create index if not exists idx_audit_logs_actor
on audit_logs(actor_username);

comment on table audit_logs is
'Append-only audit trail for DataMind operations.';


-- =====================================================
-- OWNER governed SQL execution
-- =====================================================
-- OWNER is intentionally independent from the employee-scoped ADMIN RPC.
-- This function is callable only by the server's service role. The
-- application endpoint additionally requires a signed OWNER session and a
-- short-lived approval token bound to the exact SQL text.

drop function if exists execute_owner_sql(text);

create or replace function execute_owner_sql(p_sql text)
returns setof json
language plpgsql
security definer
set statement_timeout = '15s'
set search_path = public
as $$
declare
  v_sql text := trim(p_sql);
  v_without_comments text;
  v_statement_count int;
  v_affected_rows int;
begin
  if v_sql = '' then
    raise exception 'SQL cannot be empty';
  end if;

  if length(v_sql) > 8000 then
    raise exception 'SQL exceeds the OWNER execution limit';
  end if;

  -- Remove comments for governance checks.
  v_without_comments := regexp_replace(v_sql, '--[^\n]*', '', 'g');
  v_without_comments := regexp_replace(v_without_comments, '/\*([\s\S]*?)\*/', '', 'g');

  -- One SQL operation only. A single trailing semicolon is permitted.
  v_statement_count := length(v_without_comments) - length(replace(v_without_comments, ';', ''));
  if right(trim(v_without_comments), 1) = ';' then
    v_statement_count := v_statement_count - 1;
  end if;
  if v_statement_count > 0 then
    raise exception 'Multiple SQL statements are not allowed';
  end if;

  if v_without_comments ~* '^\s*with\s' 
     and v_without_comments ~* '\\y(insert|update|delete|create|alter|drop|truncate)\\y' then
    raise exception 'WITH statements containing write or schema operations are not allowed';
  end if;

  if v_without_comments !~* '^\s*(select|with|insert|update|delete|create|alter|drop|truncate)(\s|$)' then
    raise exception 'Unrecognized or disallowed OWNER statement type';
  end if;

  if v_without_comments ~* '\y(grant|revoke|merge|call|execute|vacuum|copy|listen|notify|comment)\y'
     or v_without_comments ~* '\yalter\s+system\y'
     or v_without_comments ~* '\y(create|alter|drop)\s+(role|user|policy|trigger|function|procedure|extension)\y'
     or v_without_comments ~* '\ydrop\s+database\y'
     or v_without_comments ~* '\y(copy)\y.*\yprogram\y'
     or v_without_comments ~* '\y(pg_sleep|pg_read_file|pg_ls_dir|pg_reload_conf|lo_import|lo_export|dblink_exec|pg_terminate_backend|pg_cancel_backend)\s*'
     or v_without_comments ~* '\y(admin_users|member_users|owner_users)\y' then
    raise exception 'This OWNER operation is blocked by DataMind governance';
  end if;

  if v_without_comments ~* '^\s*(update|delete)\y'
     and v_without_comments !~* '\ywhere\y' then
    raise exception 'UPDATE/DELETE without a WHERE clause is not allowed';
  end if;

  if v_without_comments ~* '^\s*(select|with)\y' then
    return query execute format(
      'select to_json(t) from (%s) t',
      regexp_replace(v_sql, ';\s*$', '')
    );
  end if;

  execute v_sql;
  get diagnostics v_affected_rows = row_count;

  return query
    select json_build_object('affected_rows', coalesce(v_affected_rows, 0));
end;
$$;

revoke all on function execute_owner_sql(text) from public, anon, authenticated;
grant execute on function execute_owner_sql(text) to service_role;

comment on function execute_owner_sql(text) is
  'DataMind OWNER control-plane execution. Server-side session/approval checks are required before calling this function.';
