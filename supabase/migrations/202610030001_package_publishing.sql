-- Organization configuration publishing. Run once after 202609280001_organization_workspaces.sql.
-- Admins publish a new package version from the dashboard; apps pick it up at next launch.
begin;
create table if not exists public.organization_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  package_id text not null,
  version text not null,
  package jsonb not null,
  published_by uuid not null references auth.users(id),
  published_at timestamptz not null default now(),
  unique (organization_id, package_id, version)
);
create index if not exists organization_packages_org_idx
  on public.organization_packages(organization_id, published_at desc);
alter table public.organization_packages enable row level security;
revoke all on public.organization_packages from anon, authenticated;
grant select on public.organization_packages to authenticated;

create policy organization_packages_admin on public.organization_packages for select to authenticated using (
  exists(select 1 from public.organization_members m where m.organization_id = organization_packages.organization_id
    and m.user_id = auth.uid() and m.role = 'admin')
);

-- Single write path for configuration. Structural checks only: the app performs
-- full validation and keeps its last valid package if a publication is rejected.
create or replace function public.publish_package(org uuid, pkg jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  rid uuid;
begin
  if actor is null or not exists(select 1 from public.organization_members m
      where m.organization_id = org and m.user_id = actor and m.role = 'admin') then
    raise exception 'Organization administrator required' using errcode = '42501';
  end if;
  if jsonb_typeof(pkg) is distinct from 'object'
    or (pkg->>'formatVersion') is distinct from '1'
    or coalesce(pkg->>'id', '') = '' or coalesce(pkg->>'version', '') = '' or coalesce(pkg->>'title', '') = ''
    or position('{{TRANSCRIPT}}' in coalesce(pkg->>'prompt', '')) = 0
    or position('{{SCHEMA}}' in coalesce(pkg->>'prompt', '')) = 0
    or jsonb_typeof(pkg->'fields') is distinct from 'array' or jsonb_array_length(pkg->'fields') = 0
    or (pkg ? 'model' and coalesce(pkg->'model'->>'sha256', '') !~ '^[a-fA-F0-9]{64}$')
    or (pkg ? 'model' and pkg->'model' ? 'url' and coalesce(pkg->'model'->>'url', '') !~ '^https://') then
    raise exception 'Invalid package' using errcode = '22023';
  end if;
  insert into public.organization_packages(organization_id, package_id, version, package, published_by)
  values (org, pkg->>'id', pkg->>'version', pkg, actor)
  returning id into rid;
  update public.organizations set package = pkg where id = org;
  return rid;
end $$;
revoke all on function public.publish_package(uuid, jsonb) from public, anon;
grant execute on function public.publish_package(uuid, jsonb) to authenticated;
commit;
