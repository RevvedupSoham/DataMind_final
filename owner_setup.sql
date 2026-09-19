-- DataMind — Owner authentication setup
--
-- Run this AFTER the existing DataMind auth setup.
-- This file does not recreate or modify admin_users/member_users.
--
-- Owner is an application role, not automatically a PostgreSQL superuser.
-- Actual database capabilities remain limited by the Supabase/PostgreSQL
-- credentials used by DataMind.

create extension if not exists pgcrypto;

create table if not exists owner_users (
  id bigint generated always as identity primary key,
  username text not null unique,
  password_hash text not null,
  display_name text,
  created_at timestamptz not null default now()
);

revoke all on table owner_users from public, anon, authenticated;

drop function if exists verify_owner_login(text, text);

create or replace function verify_owner_login(
  p_username text,
  p_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return exists (
    select 1
    from owner_users
    where username = p_username
      and password_hash = crypt(p_password, password_hash)
  );
end;
$$;

revoke all on function verify_owner_login(text, text) from public, anon, authenticated;
grant execute on function verify_owner_login(text, text) to service_role;

comment on table owner_users is
  'DataMind Owner accounts. Passwords are stored as pgcrypto bcrypt hashes.';

comment on function verify_owner_login(text, text) is
  'DataMind: verifies Owner credentials server-side.';
