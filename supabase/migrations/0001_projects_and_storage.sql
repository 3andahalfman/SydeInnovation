-- Local development schema for the SydeInnovation portfolio/admin CMS.
-- Mirrors the shape expected by the app (see src/types/project.ts and
-- the Supabase queries in src/pages/PortfolioPage.tsx and src/pages/AdminPage.tsx).

create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  thumbnail_url text,
  aps_urn text,
  category text,
  tech text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

-- RLS policies gate row visibility, but the API roles still need table grants.
grant select on public.projects to anon;
grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;

-- Portfolio page reads projects anonymously.
drop policy if exists "Public can read projects" on public.projects;
create policy "Public can read projects"
  on public.projects for select
  to anon, authenticated
  using (true);

-- Admin console (logged-in user) manages projects.
drop policy if exists "Authenticated can manage projects" on public.projects;
create policy "Authenticated can manage projects"
  on public.projects for all
  to authenticated
  using (true)
  with check (true);

-- Storage bucket for project thumbnails (uploaded from the admin console).
insert into storage.buckets (id, name, public)
values ('project-thumbnails', 'project-thumbnails', true)
on conflict (id) do nothing;

drop policy if exists "Public can read thumbnails" on storage.objects;
create policy "Public can read thumbnails"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'project-thumbnails');

drop policy if exists "Authenticated can write thumbnails" on storage.objects;
create policy "Authenticated can write thumbnails"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'project-thumbnails')
  with check (bucket_id = 'project-thumbnails');
