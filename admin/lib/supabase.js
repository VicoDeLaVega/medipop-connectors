import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export function createUserClient(accessToken) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Configure SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.');
  // Never reuse an authenticated client across requests/users.
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {}),
  });
}
export async function requireAdmin() {
  const jar = await cookies();
  const token = jar.get('medipop-access')?.value;
  if (!token) redirect('/login');
  const supabase = createUserClient(token);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) redirect('/login?expired=1');
  const { data: memberships, error: membershipError } = await supabase
    .from('organization_members').select('organization_id, role').eq('user_id', user.id).eq('role', 'admin');
  if (membershipError) throw new Error('Cannot verify organization access.');
  if (!memberships?.length) redirect('/login?forbidden=1');
  const chosen = jar.get('medipop-org')?.value;
  const organizationId = memberships.find((m) => m.organization_id === chosen)?.organization_id
    ?? memberships[0].organization_id;
  return { supabase, user, organizationId, memberships };
}
export async function fetchConsultations({ limit = 50 } = {}) {
  const context = await requireAdmin();
  const { data, error } = await context.supabase.rpc('admin_consultations', {
    org: context.organizationId, row_limit: limit,
  });
  if (error) throw new Error('Cannot read consultations. Verify the organization migration.');
  return data ?? [];
}
