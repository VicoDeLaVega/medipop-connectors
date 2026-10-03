/// Supabase adapters for Medipop: identity, organization configuration and sync.
library;

import 'package:medipop_core/medipop_core.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'src/supabase_identity.dart';
import 'src/supabase_sync.dart';

export 'src/supabase_identity.dart' show SupabaseIdentity;
export 'src/supabase_sync.dart' show SupabaseConfigSource, SupabaseSync;

/// Initializes Supabase and returns the matching adapters. Only the project
/// URL and publishable key are needed; never ship a service-role key.
Future<MedipopAdapters> supabaseAdapters(
    {required String url, required String publishableKey}) async {
  await Supabase.initialize(url: url, publishableKey: publishableKey);
  final client = Supabase.instance.client;
  return MedipopAdapters(
      identity: SupabaseIdentity(client),
      config: SupabaseConfigSource(client),
      sync: SupabaseSync(client));
}
