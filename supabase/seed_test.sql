-- TEST PROJECT ONLY. Run after migrations/202609280001_organization_workspaces.sql.
-- Prerequisite: create these four users in Authentication → Users (dashboard),
-- then replace the emails below. Two organizations prove isolation between
-- tenants (e.g. APTITUD and any other medical service) on the same engine.
begin;

with orgs as (
  insert into public.organizations (name, package) values
    ('Test Org A', null),   -- null = public example package bundled in the app
    ('Test Org B', null)
  returning id, name
), members(email, org_name, role) as (
  values
    ('doctor-a@example.test', 'Test Org A', 'doctor'),
    ('admin-a@example.test',  'Test Org A', 'admin'),
    ('doctor-b@example.test', 'Test Org B', 'doctor'),
    ('admin-b@example.test',  'Test Org B', 'admin')
)
insert into public.organization_members (organization_id, user_id, role)
select o.id, u.id, m.role
from members m
join orgs o on o.name = m.org_name
join auth.users u on lower(u.email) = lower(m.email);

-- Fails the whole seed if an email has no matching auth user.
do $$ begin
  if (select count(*) from public.organization_members) < 4 then
    raise exception 'Create the four auth users first (emails must match).';
  end if;
end $$;

commit;
