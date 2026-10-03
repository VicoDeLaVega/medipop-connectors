# medipop-connectors

Adapters that connect [medipop-core](https://github.com/VicoDeLaVega/medipop-core) to identity providers, configuration sources and storage backends. The core runs alone; organizations add only the adapters their law and infrastructure allow.

## Contents

| Path | What it is |
|---|---|
| `medipop_supabase/` | Dart package: `SupabaseIdentity` (email/password, organization membership verified on the server, offline cache), `SupabaseConfigSource` (`organizations.package`), `SupabaseSync` (idempotent `submit_consultation` RPC). `supabaseAdapters(url:, publishableKey:)` returns all three. |
| `supabase/` | SQL: organizations, memberships, consultations, RLS, write RPC (`migrations/`), plus a two-organization seed for test projects (`seed_test.sql`). Plain PostgreSQL: runs on Supabase Cloud or self-hosted (e.g. on certified health-data hosting). |
| `admin/` | Next.js dashboard for organization admins: sign-in, consultations, JSON export. Uses the signed-in user's token and RLS; never a service-role key. |
| `tool/verify_rls.mjs` | Runs the migration on embedded PostgreSQL (PGlite) and checks isolation, roles and idempotency. |

Planned: generic OIDC identity (Pro Santé Connect, ClaveÚnica, Keycloak…), HTTPS webhook sync, and a declarative exporter (spreadsheets, activity reports).

## Use in an app shell

```yaml
dependencies:
  medipop_core:
    git: { url: https://github.com/VicoDeLaVega/medipop-core.git, ref: main }
  medipop_supabase:
    git: { url: https://github.com/VicoDeLaVega/medipop-connectors.git, ref: main, path: medipop_supabase }
```

```dart
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runMedipop(await supabaseAdapters(
      url: const String.fromEnvironment('SUPABASE_URL'),
      publishableKey: const String.fromEnvironment('SUPABASE_PUBLISHABLE_KEY')));
}
```

For local development next to a `medipop-core` checkout, `medipop_supabase/pubspec_overrides.yaml` (not committed) can point `medipop_core` to `../../medipop-core`.

## Set up a Supabase project

Follow [docs/MIGRATION.md](docs/MIGRATION.md): back up, run the migration once, create users in Supabase Auth, insert memberships (`supabase/seed_test.sql` for a test project), set `organizations.package` (NULL = public example).

## Verify

```sh
(cd medipop_supabase && flutter pub get && flutter analyze)
npm install --prefix /tmp/medipop-sql-tests @electric-sql/pglite
node tool/verify_rls.mjs /tmp/medipop-sql-tests/node_modules/@electric-sql/pglite/dist/index.js
(cd admin && npm ci && npm run build)
```

## License

MIT. See [LICENSE](LICENSE).
