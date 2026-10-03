-- Run as database owner after backup. No real users, organizations or packages are seeded.
begin;
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  package jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('doctor', 'admin')),
  primary key (organization_id, user_id)
);
create table if not exists public.consultations (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id),
  created_by_user_id uuid not null references auth.users(id),
  device_id uuid not null,
  schema_id text not null,
  schema_version text not null,
  schema_snapshot jsonb not null,
  payload jsonb not null,
  raw_transcript text not null,
  status text not null default 'validated' check (status = 'validated'),
  legacy_source_id text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  validated_at timestamptz not null,
  synced_at timestamptz not null default now()
);
create index if not exists consultations_org_created_idx on public.consultations(organization_id, created_at desc);
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.consultations enable row level security;
revoke all on public.organizations, public.organization_members, public.consultations from anon, authenticated;
grant select on public.organizations, public.organization_members, public.consultations to authenticated;

create policy memberships_self on public.organization_members for select to authenticated using (user_id = auth.uid());
create policy organizations_member on public.organizations for select to authenticated using (
  exists(select 1 from public.organization_members m where m.organization_id = organizations.id and m.user_id = auth.uid())
);
create policy consultations_member on public.consultations for select to authenticated using (
  exists(select 1 from public.organization_members m where m.organization_id = consultations.organization_id and m.user_id = auth.uid()
    and (m.role = 'admin' or consultations.created_by_user_id = auth.uid()))
);

-- No client INSERT/UPDATE grants: this function is the single validated write path.
create or replace function public.submit_consultation(record jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  org uuid := (record->>'organization_id')::uuid;
  rid uuid := (record->>'id')::uuid;
  previous public.consultations;
begin
  if actor is null or (record->>'created_by_user_id')::uuid is distinct from actor then
    raise exception 'Creator does not match authenticated user' using errcode = '42501';
  end if;
  if not exists(select 1 from public.organization_members m where m.user_id = actor and m.organization_id = org) then
    raise exception 'Organization membership required' using errcode = '42501';
  end if;
  if jsonb_typeof(record->'payload') is distinct from 'object'
    or jsonb_typeof(record->'schema_snapshot') is distinct from 'object'
    or nullif(record->>'schema_id', '') is null or nullif(record->>'schema_version', '') is null
    or (record->'schema_snapshot'->>'id') is distinct from (record->>'schema_id')
    or (record->'schema_snapshot'->>'version') is distinct from (record->>'schema_version')
    or (record->>'status') is distinct from 'validated' then
    raise exception 'Invalid consultation envelope' using errcode = '22023';
  end if;
  -- The same UUID can only acknowledge the exact same immutable validated record.
  insert into public.consultations(id, organization_id, created_by_user_id, device_id, schema_id,
    schema_version, schema_snapshot, payload, raw_transcript, status, legacy_source_id, created_at, updated_at, validated_at)
  values (rid, org, actor, (record->>'device_id')::uuid, record->>'schema_id', record->>'schema_version',
    record->'schema_snapshot', record->'payload', record->>'raw_transcript', 'validated', record->>'legacy_source_id',
    (record->>'created_at')::timestamptz, (record->>'updated_at')::timestamptz, (record->>'validated_at')::timestamptz)
  on conflict (id) do nothing;
  select * into previous from public.consultations where id = rid;
  if previous.organization_id is distinct from org or previous.created_by_user_id is distinct from actor
    or previous.device_id is distinct from (record->>'device_id')::uuid
    or previous.schema_id is distinct from record->>'schema_id'
    or previous.schema_version is distinct from record->>'schema_version'
    or previous.schema_snapshot is distinct from record->'schema_snapshot'
    or previous.payload is distinct from record->'payload'
    or previous.raw_transcript is distinct from record->>'raw_transcript'
    or previous.legacy_source_id is distinct from record->>'legacy_source_id'
    or previous.created_at is distinct from (record->>'created_at')::timestamptz
    or previous.updated_at is distinct from (record->>'updated_at')::timestamptz
    or previous.validated_at is distinct from (record->>'validated_at')::timestamptz then
    raise exception 'UUID already used by a different record' using errcode = '42501';
  end if;
  return rid;
end $$;
revoke all on function public.submit_consultation(jsonb) from public, anon;
grant execute on function public.submit_consultation(jsonb) to authenticated;

create or replace function public.admin_consultations(org uuid, row_limit integer default 200)
returns setof public.consultations language plpgsql security invoker set search_path = '' as $$
begin
  if not exists(select 1 from public.organization_members m where m.organization_id = org and m.user_id = auth.uid() and m.role = 'admin') then
    raise exception 'Organization administrator required' using errcode = '42501';
  end if;
  return query select * from public.consultations c where c.organization_id = org
    order by c.created_at desc, c.id limit greatest(1, least(row_limit, 1000));
end $$;
revoke all on function public.admin_consultations(uuid, integer) from public, anon;
grant execute on function public.admin_consultations(uuid, integer) to authenticated;

-- Existing remote prescriptions stay untouched and inaccessible until explicitly migrated.
do $$ begin
  if to_regclass('public.prescriptions') is not null then
    execute 'drop policy if exists "prototype public read prescriptions" on public.prescriptions';
    execute 'drop policy if exists "prototype public insert prescriptions" on public.prescriptions';
    execute 'revoke all on public.prescriptions from anon, authenticated';
  end if;
end $$;
commit;
