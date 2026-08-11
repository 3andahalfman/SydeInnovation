-- Unified admin auth + lockout support
-- Run against the SydeFlow Supabase project.

alter table public.users
  add column if not exists failed_login_count integer not null default 0;

alter table public.users
  add column if not exists locked_until timestamptz;

alter table public.users
  add column if not exists auth_user_id uuid;

create index if not exists idx_users_auth_user_id on public.users(auth_user_id);
create index if not exists idx_users_locked_until on public.users(locked_until);

-- IP / email attempt log for rate visibility (optional auditing)
create table if not exists public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ip text,
  success boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_login_attempts_email_created
  on public.login_attempts (email, created_at desc);

alter table public.login_attempts enable row level security;
