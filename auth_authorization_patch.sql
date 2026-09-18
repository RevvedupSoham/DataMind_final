-- DataMind authorization patch v2
-- SAFE TO RUN on an existing database.
-- Does NOT drop/recreate admin_users or member_users.
--
-- Authorization is employee-scoped and account-independent:
--   admin1 -> employee A -> A + A's complete reporting hierarchy
--   admin2 -> employee B -> B + B's complete reporting hierarchy
--   member1 -> employee C -> C's permitted data
--   member2 -> employee D -> D's permitted data
-- No username or employee ID is hardcoded.

create or replace function get_hierarchy(p_employee_id int4)
returns table(employee_id int4)
language sql
stable
security definer
set search_path = public
as $$
  with recursive hierarchy as (
    select e.id as employee_id, array[e.id]::int4[] as path
    from employee e
    where e.id = p_employee_id
    union all
    select e.id, h.path || e.id
    from employee e
    join hierarchy h on e.manager_id = h.employee_id
    where not (e.id = any(h.path))
  )
  select h.employee_id from hierarchy h;
$$;

revoke all on function get_hierarchy(int4) from public, anon, authenticated;
grant execute on function get_hierarchy(int4) to service_role;

-- Confirms that the employee_id from the signed application session really
-- belongs to an account of the claimed role. This supports any number of
-- admin/member accounts without relying on usernames.
create or replace function validate_data_mind_actor(p_role text, p_employee_id int4)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_employee_id is not null
    and exists (select 1 from employee e where e.id = p_employee_id)
    and case
      when p_role = 'admin' then exists (
        select 1 from admin_users a where a.employee_id = p_employee_id
      )
      when p_role = 'member' then exists (
        select 1 from member_users m where m.employee_id = p_employee_id
      )
      else false
    end;
$$;

revoke all on function validate_data_mind_actor(text, int4) from public, anon, authenticated;
grant execute on function validate_data_mind_actor(text, int4) to service_role;

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
  s text := lower(trim(p_sql));
  has_employee boolean;
  has_salary boolean;
  has_address boolean;
  has_history boolean;
  has_assignment boolean;
  is_aggregate boolean;
  has_where boolean;
  has_or boolean;
  own_hierarchy boolean;
  any_hierarchy boolean;
begin
  if p_role not in ('admin','member') or p_employee_id is null or p_employee_id <= 0 then
    return jsonb_build_object('authorized',false,'reason','Invalid authorization context.');
  end if;

  if not validate_data_mind_actor(p_role,p_employee_id) then
    return jsonb_build_object(
      'authorized',false,
      'reason','The authenticated account is not mapped to a valid employee record.'
    );
  end if;

  -- PostgreSQL POSIX regex uses \m / \M for word boundaries, not \b.
  has_employee := s ~ '\memployee\M';
  has_salary := s ~ '\msalary\M';
  has_address := s ~ '\maddress\M';
  has_history := s ~ '\mjob_history\M';
  has_assignment := s ~ '\mdept_assignment\M';
  has_where := s ~ '\mwhere\M';
  has_or := s ~ '\mor\M';
  is_aggregate := s ~ '\m(count|sum|avg|max|min)\M' or s ~ '\mgroup\s+by\M';

  own_hierarchy := s ~ ('\mget_hierarchy\M\s*\(\s*' || p_employee_id || '\s*\)');
  any_hierarchy := s ~ '\mget_hierarchy\M\s*\(\s*[0-9]+\s*\)';

  if p_role = 'member' then
    if has_employee or has_salary or has_address or has_history or has_assignment then
      if is_aggregate then
        if has_salary and s ~ '\m(sum|avg|max|min)\M\s*\(\s*[^)]*\mamount\M' then
          return jsonb_build_object(
            'authorized',false,
            'reason','Members cannot access salary statistics. This query requires admin access.'
          );
        end if;
        return jsonb_build_object('authorized',true,'modified_sql',p_sql);
      end if;

      if not has_where then
        return jsonb_build_object(
          'authorized',false,
          'reason','Members can only access their own employee information.'
        );
      end if;

      if not (
        s ~ ('\memployee\M\s*\.\s*id\s*=\s*' || p_employee_id || '\y')
        or s ~ ('\msalary\M\s*\.\s*employee_id\s*=\s*' || p_employee_id || '\y')
        or s ~ ('\maddress\M\s*\.\s*employee_id\s*=\s*' || p_employee_id || '\y')
        or s ~ ('\mjob_history\M\s*\.\s*employee_id\s*=\s*' || p_employee_id || '\y')
        or s ~ ('\mdept_assignment\M\s*\.\s*employee_id\s*=\s*' || p_employee_id || '\y')
      ) then
        return jsonb_build_object(
          'authorized',false,
          'reason','Members can only access records belonging to their own employee account.'
        );
      end if;

      if has_or then
        return jsonb_build_object(
          'authorized',false,
          'reason','Member employee queries must use a single authenticated employee scope.'
        );
      end if;
    end if;

    return jsonb_build_object('authorized',true,'modified_sql',p_sql);
  end if;

  if p_role = 'admin' then
    if has_history and s ~ '\mold_role\M' then
      return jsonb_build_object(
        'authorized',false,
        'reason','The old_role field in job_history is restricted. You can access new_role and changed_on only.'
      );
    end if;

    if has_salary or has_address or has_history then
      -- If get_hierarchy(...) is used, it MUST be this admin's hierarchy.
      if any_hierarchy and not own_hierarchy then
        return jsonb_build_object(
          'authorized',false,
          'reason','This admin query references another administrator hierarchy.'
        );
      end if;

      if not own_hierarchy and not (
        s ~ ('\memployee\M\s*\.\s*id\s*=\s*' || p_employee_id || '\y')
        or s ~ ('\msalary\M\s*\.\s*employee_id\s*=\s*' || p_employee_id || '\y')
        or s ~ ('\maddress\M\s*\.\s*employee_id\s*=\s*' || p_employee_id || '\y')
        or s ~ ('\mjob_history\M\s*\.\s*employee_id\s*=\s*' || p_employee_id || '\y')
      ) then
        return jsonb_build_object(
          'authorized',false,
          'reason','Admin access to sensitive data must be restricted to the authenticated employee hierarchy.'
        );
      end if;

      if not has_where and not is_aggregate then
        return jsonb_build_object(
          'authorized',false,
          'reason','Admin access to sensitive data requires an explicit employee scope.'
        );
      end if;

      if own_hierarchy and has_or then
        return jsonb_build_object(
          'authorized',false,
          'reason','Admin sensitive-data queries cannot combine hierarchy scope with an OR branch.'
        );
      end if;
    end if;

    return jsonb_build_object('authorized',true,'modified_sql',p_sql);
  end if;

  return jsonb_build_object('authorized',false,'reason','Unknown role. Authorization check failed.');
end;
$$;

revoke all on function check_query_authorization(text,text,int4) from public, anon, authenticated;
grant execute on function check_query_authorization(text,text,int4) to service_role;

drop function if exists execute_authorized_sql(text,text,int4);

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
  auth_result jsonb;
  final_sql text;
begin
  if p_sql !~* '^\s*(select|with)(\s|$)' then
    raise exception 'Only read-only SELECT/WITH statements are allowed';
  end if;

  if regexp_replace(p_sql,';\s*$','') ~ ';' then
    raise exception 'Multiple statements are not allowed';
  end if;

  auth_result := check_query_authorization(p_sql,p_role,p_employee_id);
  if not coalesce((auth_result->>'authorized')::boolean,false) then
    raise exception '%',auth_result->>'reason';
  end if;

  final_sql := auth_result->>'modified_sql';
  return query execute format('select to_json(t) from (%s) t',final_sql);
end;
$$;

revoke all on function execute_authorized_sql(text,text,int4) from public, anon, authenticated;
grant execute on function execute_authorized_sql(text,text,int4) to service_role;

-- Admin writes are also employee-scoped. Authentication tables and job_history
-- are never writable through DataMind. The current UI requires confirmation
-- before this function is reached.
drop function if exists execute_privileged_sql(text,text,int4);

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
  s text := lower(trim(p_sql));
  is_read boolean;
  has_employee boolean;
  has_salary boolean;
  has_address boolean;
  has_assignment boolean;
  has_history boolean;
  has_where boolean;
  has_or boolean;
  own_hierarchy boolean;
begin
  if p_role <> 'admin' then raise exception 'Write operations require admin access'; end if;

  if not validate_data_mind_actor('admin',p_employee_id) then
    raise exception 'The authenticated admin account is not mapped to a valid employee record';
  end if;

  if s ~ '\m(grant|revoke|merge|call|execute|vacuum|copy|listen|notify|comment|set)\M'
     or s ~ '\m(pg_read_file|pg_ls_dir|pg_reload_conf|lo_import|lo_export|dblink_exec|pg_terminate_backend|pg_cancel_backend)\M' then
    raise exception 'This operation is not permitted, even for admin accounts';
  end if;

  if p_sql !~* '^\s*(select|with|insert|update|delete|create|drop|alter|truncate)(\s|$)' then
    raise exception 'Unrecognized or disallowed statement type';
  end if;

  if regexp_replace(p_sql,';\s*$','') ~ ';' then
    raise exception 'Multiple statements are not allowed';
  end if;

  if s ~ '\m(admin_users|member_users|job_history)\M' then
    raise exception 'Authentication and job-history tables cannot be modified through DataMind';
  end if;

  is_read := s ~ '^\s*(select|with)(\s|$)';
  if is_read then
    -- Reads use the same per-account hierarchy authorization as the read RPC.
    return query execute format(
      'select to_json(t) from (%s) t',
      (check_query_authorization(p_sql,'admin',p_employee_id)->>'modified_sql')
    );
    return;
  end if;

  if s ~ '^\s*(create|drop|alter|truncate)\M' then
    raise exception 'Schema changes are not permitted through DataMind';
  end if;

  has_employee := s ~ '\memployee\M';
  has_salary := s ~ '\msalary\M';
  has_address := s ~ '\maddress\M';
  has_assignment := s ~ '\mdept_assignment\M';
  has_history := s ~ '\mjob_history\M';
  has_where := s ~ '\mwhere\M';
  has_or := s ~ '\mor\M';
  own_hierarchy := s ~ ('\mget_hierarchy\M\s*\(\s*' || p_employee_id || '\s*\)');

  if has_history then raise exception 'job_history cannot be modified through DataMind'; end if;
  if not (has_employee or has_salary or has_address or has_assignment) then
    raise exception 'This table is not writable through DataMind';
  end if;

  -- UPDATE/DELETE must name a row inside the authenticated hierarchy.
  if s ~ '^\s*(update|delete)\M' then
    if not has_where or has_or then
      raise exception 'Admin updates/deletes require one employee-scoped WHERE clause';
    end if;
    if not own_hierarchy and not (
      s ~ ('\memployee\M\s*\.\s*id\s*=\s*' || p_employee_id || '\y')
      or s ~ ('\bid\s*=\s*' || p_employee_id || '\y')
      or s ~ ('\memployee_id\M\s*=\s*' || p_employee_id || '\y')
    ) then
      raise exception 'Admin writes must target employees inside the authenticated hierarchy';
    end if;
  end if;

  -- INSERTs must attach the new row to the authenticated hierarchy.
  if s ~ '^\s*insert\M' then
    if has_employee then
      if not own_hierarchy and not s ~ ('\mmanager_id\M\s*=\s*' || p_employee_id || '\y') then
        raise exception 'New employees must be assigned to the authenticated admin hierarchy';
      end if;
    elsif has_salary or has_address or has_assignment then
      if not own_hierarchy and not s ~ ('\memployee_id\M\s*=\s*' || p_employee_id || '\y') then
        raise exception 'New records must belong to the authenticated admin hierarchy';
      end if;
    end if;
  end if;

  execute p_sql;
  return;
end;
$$;

revoke all on function execute_privileged_sql(text,text,int4) from public, anon, authenticated;
grant execute on function execute_privileged_sql(text,text,int4) to service_role;

comment on function execute_privileged_sql(text,text,int4) is
  'DataMind: executes admin-authorized SQL for the authenticated employee hierarchy only';
