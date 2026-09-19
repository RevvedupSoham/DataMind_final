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
