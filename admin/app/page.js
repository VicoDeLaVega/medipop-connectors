import { AdminShell } from '@/components/admin-shell';
import { ConsultationCard } from '@/components/consultation-card';
import { fetchConsultations } from '@/lib/supabase';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const entries = await fetchConsultations({ limit: 12 });
  return <AdminShell><section className="panel"><h2>Recent consultations</h2>
    <p>{entries.length} entries shown (up to 12).</p>
    <div className="entry-list">{entries.map((entry) => <ConsultationCard key={entry.id} entry={entry} />)}</div>
  </section></AdminShell>;
}
