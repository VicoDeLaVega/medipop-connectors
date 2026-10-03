 'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createUserClient, requireAdmin } from '@/lib/supabase';

const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' };
export async function login(formData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) redirect('/login?error=1');
  let session;
  try {
    const { data, error } = await createUserClient().auth.signInWithPassword({ email, password });
    if (!error) session = data.session;
  } catch { /* Do not disclose account existence or service internals. */ }
  if (!session) redirect('/login?error=1');
  const jar = await cookies();
  jar.set('medipop-access', session.access_token, { ...options, maxAge: session.expires_in });
  jar.delete('medipop-org');
  redirect('/');
}
export async function logout() {
  const jar = await cookies();
  jar.delete('medipop-access'); jar.delete('medipop-org');
  redirect('/login');
}
export async function selectOrganization(formData) {
  const { memberships } = await requireAdmin();
  const id = String(formData.get('organization_id'));
  if (!memberships.some((m) => m.organization_id === id)) throw new Error('Organization not authorized.');
  (await cookies()).set('medipop-org', id, options);
  redirect('/');
}
