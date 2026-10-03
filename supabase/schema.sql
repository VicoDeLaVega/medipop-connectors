create extension if not exists pgcrypto;

create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  display_id text not null unique,
  source_prescription_id text,
  status text not null default 'validated',
  raw_transcript text not null,
  patient_first_name text,
  patient_last_name text,
  patient_external_id text,
  doctor_first_name text,
  doctor_last_name text,
  doctor_external_id text,
  medications_json jsonb not null default '[]'::jsonb,
  payload jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  validated_at timestamptz,
  synced_at timestamptz not null default timezone('utc', now())
);

create index if not exists prescriptions_created_at_idx
  on public.prescriptions (created_at desc);

create index if not exists prescriptions_display_id_idx
  on public.prescriptions (display_id);

create index if not exists prescriptions_patient_external_id_idx
  on public.prescriptions (patient_external_id);

alter table public.prescriptions enable row level security;

-- Historical table retained only for reviewed migration.
revoke all on public.prescriptions from anon, authenticated;
drop policy if exists "prototype public read prescriptions" on public.prescriptions;
drop policy if exists "prototype public insert prescriptions" on public.prescriptions;
-- Apply migrations/202609280001_organization_workspaces.sql next.
