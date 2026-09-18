-- DataMind authorization patch
-- SAFE TO RUN on an existing database.
-- This does NOT drop/recreate admin_users or member_users.
-- It only replaces the query authorization function used by
-- execute_authorized_sql / execute_privileged_sql.

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
