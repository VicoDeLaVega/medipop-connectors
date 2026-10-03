import { fetchConsultations } from '@/lib/supabase';
export const dynamic = 'force-dynamic';
export async function GET() {
  const records = await fetchConsultations({ limit: 1000 });
  return Response.json({ limit: 1000, count: records.length, records }, {
    headers: { 'Content-Disposition': 'attachment; filename="medipop-consultations.json"', 'Cache-Control': 'private, no-store' },
  });
}
