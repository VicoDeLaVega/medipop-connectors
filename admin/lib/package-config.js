import 'server-only';
import prescription from '@/lib/templates/example-prescription.json';

// Models offered in the dashboard. Hashes are the publisher's SHA-256; the app
// refuses any file that does not match.
export const MODEL_CATALOG = [
  {
    key: 'qwen3-1.7b-q4km',
    name: 'Qwen3 1.7B Q4_K_M (unsloth)',
    sizeLabel: '1.1 GB',
    sha256: 'b139949c5bd74937ad8ed8c8cf3d9ffb1e99c866c823204dc42c0d91fa181897',
    url: 'https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf',
  },
];

export const LOCALES = [
  { code: 'fr_FR', label: 'Français (France)' },
  { code: 'en_US', label: 'English (US)' },
  { code: 'en_GB', label: 'English (UK)' },
  { code: 'es_ES', label: 'Español (España)' },
  { code: 'es_CL', label: 'Español (Chile)' },
  { code: 'pt_BR', label: 'Português (Brasil)' },
];

export const TEMPLATES = { prescription };

/** Next patch version: 1.1.0 -> 1.1.1; anything else gets a timestamp suffix. */
export function nextVersion(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? '');
  if (!m) return `1.0.0-${Date.now()}`;
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const SHA = /^[a-fA-F0-9]{64}$/;

/** Builds a package from the form; throws Error with a readable message. */
export function buildPackage(current, form) {
  const template = form.template && TEMPLATES[form.template];
  const base = template ?? current ?? TEMPLATES.prescription;
  let fields = base.fields;
  // Choosing a template replaces fields and prompt; otherwise the editors win.
  if (!template && form.fieldsJson?.trim()) {
    try { fields = JSON.parse(form.fieldsJson); } catch { throw new Error('Fields: invalid JSON.'); }
  }
  if (!Array.isArray(fields) || fields.length === 0) throw new Error('Fields: at least one field is required.');
  const prompt = (!template && form.prompt?.trim()) || base.prompt;
  if (!prompt.includes('{{SCHEMA}}') || !prompt.includes('{{TRANSCRIPT}}')) {
    throw new Error('Prompt must contain {{SCHEMA}} and {{TRANSCRIPT}}.');
  }
  const locales = form.locales.filter((l) => LOCALES.some((x) => x.code === l));
  if (locales.length === 0) throw new Error('Choose at least one dictation language.');
  const ordered = [form.defaultLocale, ...locales.filter((l) => l !== form.defaultLocale)]
    .filter((l) => locales.includes(l));

  let model;
  if (form.model === 'custom') {
    if (!SHA.test(form.modelSha ?? '')) throw new Error('Model: SHA-256 must be 64 hexadecimal characters.');
    if (form.modelUrl && !form.modelUrl.startsWith('https://')) throw new Error('Model: URL must use HTTPS.');
    model = { name: form.modelName || 'Custom model', sha256: form.modelSha.toLowerCase(), ...(form.modelUrl ? { url: form.modelUrl } : {}) };
  } else if (form.model !== 'none') {
    const m = MODEL_CATALOG.find((x) => x.key === form.model);
    if (!m) throw new Error('Model: unknown choice.');
    model = { name: m.name, sha256: m.sha256, url: m.url };
  }

  const branding = {};
  if (form.brandName?.trim()) branding.name = form.brandName.trim();
  if (form.brandColor) {
    if (!HEX.test(form.brandColor)) throw new Error('Branding: color must look like #1E40AF.');
    branding.primaryColor = form.brandColor;
  }
  if (form.brandLogo?.trim()) {
    if (!form.brandLogo.startsWith('https://')) throw new Error('Branding: logo URL must use HTTPS.');
    branding.logoUrl = form.brandLogo.trim();
  }

  const title = form.title?.trim() || base.title;
  return {
    formatVersion: 1,
    id: base.id,
    version: current ? nextVersion(current.version) : base.version,
    title,
    locales: ordered,
    ...(Object.keys(branding).length ? { branding } : {}),
    fields,
    prompt,
    ...(model ? { model } : {}),
  };
}
