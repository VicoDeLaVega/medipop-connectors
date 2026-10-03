import { login } from './actions';
export const dynamic = 'force-dynamic';
export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  return <main className="shell"><section className="panel" style={{ maxWidth: 440, margin: '60px auto' }}>
    <h1>Medipop administration</h1>
    <p>Sign in with your organization administrator account.</p>
    {(params.error || params.expired || params.forbidden) && <p role="alert">{params.forbidden
      ? 'An administrator role is required for this dashboard.'
      : params.expired ? 'Your session expired. Please sign in again.' : 'Sign-in failed. Check your credentials and connection.'}</p>}
    <form action={login} className="grid">
      <label>Email<input name="email" type="email" autoComplete="username" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      <button type="submit">Sign in</button>
    </form>
  </section></main>;
}
