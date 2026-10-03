import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// Install @electric-sql/pglite in a temporary directory; pass its module URL as argument.
const { PGlite } = await import(process.argv[2] ?? '@electric-sql/pglite');
const db = new PGlite();
await db.exec(`create role anon; create role authenticated;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;`);
await db.exec(`create table public.prescriptions(id integer primary key); insert into public.prescriptions values (1); alter table public.prescriptions enable row level security; grant select, insert on public.prescriptions to anon, authenticated; create policy \"prototype public read prescriptions\" on public.prescriptions for select to anon, authenticated using(true);`);
await db.exec(await readFile(new URL('../supabase/migrations/202609280001_organization_workspaces.sql', import.meta.url), 'utf8'));
const a = '10000000-0000-4000-8000-000000000001', b = '10000000-0000-4000-8000-000000000002';
const doctor = '20000000-0000-4000-8000-000000000001', admin = '20000000-0000-4000-8000-000000000002', other = '20000000-0000-4000-8000-000000000003';
await db.exec(`insert into auth.users values ('${doctor}'), ('${admin}'), ('${other}');
insert into public.organizations(id,name) values ('${a}', 'A'), ('${b}', 'B');
insert into public.organization_members values ('${a}', '${doctor}', 'doctor'), ('${a}', '${admin}', 'admin'), ('${b}', '${other}', 'admin');`);
async function asUser(id, role = 'authenticated') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? '']);
  await db.exec(`set role ${role}`);
}
const record = { id: '30000000-0000-4000-8000-000000000001', organization_id: a, created_by_user_id: doctor,
  device_id: '40000000-0000-4000-8000-000000000001', schema_id: 'example-prescription', schema_version: '1.0.0',
  schema_snapshot: { id:'example-prescription', version:'1.0.0' }, payload: { patient: {firstName: 'Fictitious'} }, raw_transcript:'Fictitious test',
  status:'validated', created_at:'2026-09-28T00:00:00Z', updated_at:'2026-09-28T00:00:00Z', validated_at:'2026-09-28T00:00:00Z' };
const submit = (r) => db.query('select public.submit_consultation($1::jsonb)', [JSON.stringify(r)]);
await asUser(null, 'anon');
await assert.rejects(() => db.query('select * from public.consultations'));
await assert.rejects(() => db.query('select * from public.prescriptions'));
await assert.rejects(() => submit(record));
await asUser(doctor);
await submit(record); await submit(record);
assert.equal((await db.query('select * from consultations')).rows.length, 1);
await assert.rejects(() => submit({...record, payload: {changed:true}}));
await assert.rejects(() => submit({...record, organization_id:b}));
await assert.rejects(() => submit({...record, created_by_user_id:admin}));
await assert.rejects(() => db.query('select * from admin_consultations($1)', [a]));
await assert.rejects(() => db.exec("update organization_members set role = 'admin'"));
await assert.rejects(() => db.exec("delete from consultations"));
await asUser(other);
assert.equal((await db.query('select * from consultations')).rows.length, 0);
await assert.rejects(() => db.query('select * from admin_consultations($1)', [a]));
await assert.rejects(() => submit({...record, organization_id:b, created_by_user_id:other}));
await asUser(admin);
assert.equal((await db.query('select * from admin_consultations($1)', [a])).rows.length, 1);
await db.exec('reset role');
await db.query('delete from organization_members where user_id = $1', [doctor]);
await asUser(doctor);
assert.equal((await db.query('select * from consultations')).rows.length, 0);
await assert.rejects(() => submit(record));
await db.exec('reset role');
assert.equal((await db.query('select * from prescriptions')).rows.length, 1);
await db.close();
console.log('PASS: anonymous access, cross-org isolation, role escalation, direct writes, immutable retry, admin export and revocation.');
