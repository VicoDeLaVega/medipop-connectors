'use server';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/supabase';
import { buildPackage } from '@/lib/package-config';

export async function publishConfiguration(formData) {
  const { supabase, organizationId } = await requireAdmin();
  const { data: org, error } = await supabase
    .from('organizations').select('package').eq('id', organizationId).single();
  if (error) redirect(`/config?error=${encodeURIComponent('Cannot read the current configuration.')}`);

  let pkg;
  try {
    pkg = buildPackage(org.package, {
      title: formData.get('title'),
      template: formData.get('template') === 'keep' ? null : formData.get('template'),
      fieldsJson: formData.get('fields'),
      prompt: formData.get('prompt'),
      locales: formData.getAll('locales'),
      defaultLocale: formData.get('defaultLocale'),
      model: formData.get('model'),
      modelName: formData.get('modelName'),
      modelSha: formData.get('modelSha')?.trim(),
      modelUrl: formData.get('modelUrl')?.trim(),
      brandName: formData.get('brandName'),
      brandColor: formData.get('brandColor'),
      brandLogo: formData.get('brandLogo'),
    });
  } catch (e) {
    redirect(`/config?error=${encodeURIComponent(e.message)}`);
  }
  // The RPC re-checks the admin role and the package structure on the server.
  const { error: publishError } = await supabase.rpc('publish_package', { org: organizationId, pkg });
  if (publishError) {
    redirect(`/config?error=${encodeURIComponent(`Publication refused: ${publishError.message}`)}`);
  }
  redirect(`/config?published=${encodeURIComponent(pkg.version)}`);
}
