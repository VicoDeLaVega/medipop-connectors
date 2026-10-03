import Link from 'next/link';
import { requireAdmin } from '@/lib/supabase';
import { logout, selectOrganization } from '@/app/login/actions';
export async function AdminShell({ children }) {
  const { organizationId, memberships } = await requireAdmin();
  return <main className="shell"><header className="topbar">
    <div className="brand"><span className="eyebrow">Medipop</span><h1 className="title">Consultations</h1></div>
    <nav className="nav"><Link href="/">Overview</Link><Link href="/entries">All entries</Link><Link href="/latest">Latest</Link>
      <a href="/export">Export JSON (up to 1,000)</a></nav>
    <form action={logout}><button>Sign out</button></form>
  </header>
  <form action={selectOrganization} className="panel">
    <label>Organization <select name="organization_id" defaultValue={organizationId}>
      {memberships.map((m) => <option key={m.organization_id} value={m.organization_id}>{m.organization_id}</option>)}
    </select></label> <button>Switch</button>
  </form>{children}</main>;
}
