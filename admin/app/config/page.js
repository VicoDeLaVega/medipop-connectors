import { AdminShell } from '@/components/admin-shell';
import { requireAdmin } from '@/lib/supabase';
import { LOCALES, MODEL_CATALOG, TEMPLATES } from '@/lib/package-config';
import { publishConfiguration } from './actions';

export const dynamic = 'force-dynamic';

function label(l) {
  return typeof l === 'string' ? l : l?.fr ?? l?.en ?? Object.values(l ?? {})[0];
}

function FieldTree({ fields }) {
  return <ul className="field-tree">{fields.map((f) => <li key={f.id}>
    <strong>{label(f.label)}</strong> <span className="muted">{f.type}{f.required ? ' · required' : ''}</span>
    {f.fields ? <FieldTree fields={f.fields} /> : null}
  </li>)}</ul>;
}

export default async function ConfigPage({ searchParams }) {
  const params = await searchParams;
  const { supabase, organizationId } = await requireAdmin();
  const { data: org } = await supabase
    .from('organizations').select('name, package').eq('id', organizationId).single();
  const { data: history } = await supabase
    .from('organization_packages').select('version, published_at')
    .eq('organization_id', organizationId).order('published_at', { ascending: false }).limit(10);

  const current = org?.package ?? null;
  const shown = current ?? TEMPLATES.prescription;
  const locales = shown.locales ?? [shown.locale ?? 'en_US'];
  const catalogKey = MODEL_CATALOG.find((m) => m.sha256 === shown.model?.sha256)?.key
    ?? (shown.model ? 'custom' : 'none');

  return <AdminShell><section className="panel">
    <span className="eyebrow">{org?.name}</span>
    <h2>Configuration</h2>
    <p className="muted">
      {current ? <>Published version <strong>{current.version}</strong>.</>
        : <>No configuration published: apps use the public example ({TEMPLATES.prescription.version}).</>}
      {' '}Apps apply a new version at their next launch. Saved consultations keep the version they were created with.
    </p>
    {params?.published ? <p className="notice ok">Version {params.published} published.</p> : null}
    {params?.error ? <p className="notice error">{params.error}</p> : null}

    <form action={publishConfiguration} className="config-form">
      <fieldset><legend>Branding</legend>
        <label>Name shown in the app<input name="brandName" defaultValue={shown.branding?.name ?? org?.name ?? ''} /></label>
        <label>Main color<input name="brandColor" type="color" defaultValue={shown.branding?.primaryColor ?? '#3F5E99'} /></label>
        <label>Logo URL (HTTPS, PNG or JPEG)<input name="brandLogo" type="url" defaultValue={shown.branding?.logoUrl ?? ''} placeholder="https://…" /></label>
      </fieldset>

      <fieldset><legend>Dictation languages</legend>
        {LOCALES.map((l) => <label key={l.code} className="inline">
          <input type="checkbox" name="locales" value={l.code} defaultChecked={locales.includes(l.code)} /> {l.label}
        </label>)}
        <label>Default language<select name="defaultLocale" defaultValue={locales[0]}>
          {LOCALES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select></label>
      </fieldset>

      <fieldset><legend>AI model</legend>
        <label>Model<select name="model" defaultValue={catalogKey}>
          {MODEL_CATALOG.map((m) => <option key={m.key} value={m.key}>{m.name} · {m.sizeLabel}</option>)}
          <option value="custom">Custom model…</option>
          <option value="none">No model (manual entry only)</option>
        </select></label>
        <details open={catalogKey === 'custom'}><summary>Custom model</summary>
          <label>Name<input name="modelName" defaultValue={catalogKey === 'custom' ? shown.model?.name ?? '' : ''} /></label>
          <label>SHA-256<input name="modelSha" className="mono" defaultValue={catalogKey === 'custom' ? shown.model?.sha256 ?? '' : ''} /></label>
          <label>Download URL (HTTPS)<input name="modelUrl" type="url" defaultValue={catalogKey === 'custom' ? shown.model?.url ?? '' : ''} /></label>
        </details>
      </fieldset>

      <fieldset><legend>Data collected</legend>
        <label>Form title<input name="title" defaultValue={shown.title} /></label>
        <label>Start from<select name="template" defaultValue="keep">
          <option value="keep">Current form (edit below)</option>
          <option value="prescription">Template: prescription (example)</option>
        </select></label>
        <p className="muted">Current fields:</p>
        <FieldTree fields={shown.fields} />
        <details><summary>Advanced: edit fields and prompt (JSON)</summary>
          <p className="muted">Format described in medipop-core docs/PACKAGES.md. Labels can be {'{"fr": "…", "en": "…"}'}.</p>
          <label>Fields<textarea name="fields" rows={18} className="mono" defaultValue={JSON.stringify(shown.fields, null, 2)} /></label>
          <label>Prompt<textarea name="prompt" rows={6} defaultValue={shown.prompt} /></label>
        </details>
      </fieldset>

      <button type="submit" className="primary">Publish new version</button>
    </form>
  </section>

  <section className="panel"><h2>History</h2>
    {history?.length ? <ul>{history.map((h) => <li key={h.version}>
      <strong>{h.version}</strong> <span className="muted">{new Date(h.published_at).toLocaleString('fr-FR')}</span>
    </li>)}</ul> : <p className="muted">No version published yet.</p>}
  </section></AdminShell>;
}
