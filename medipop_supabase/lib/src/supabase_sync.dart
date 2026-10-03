import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;
import 'package:medipop_core/medipop_core.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'supabase_identity.dart';

/// Reads the organization's package from `organizations.package`.
/// SQL NULL selects the fallback package bundled with the app.
class SupabaseConfigSource extends ConfigSource {
  SupabaseConfigSource(this.client, {this.fallbackAsset = examplePackageAsset});
  final SupabaseClient client;
  final String fallbackAsset;

  @override
  Future<ClinicalPackage> load(Identity identity) async {
    try {
      final org = await client
          .from('organizations')
          .select('package')
          .eq('id', identity.organizationId)
          .single();
      return org['package'] == null
          ? ClinicalPackage.parse(await rootBundle.loadString(fallbackAsset))
          : ClinicalPackage.parse(jsonEncode(org['package']));
    } catch (e) {
      if (isNetworkError(e)) throw OfflineException(e.toString());
      rethrow;
    }
  }
}

/// Single write path: the `submit_consultation` RPC verifies creator,
/// membership and UUID immutability on every retry.
class SupabaseSync implements SyncTarget {
  SupabaseSync(this.client);
  final SupabaseClient client;

  @override
  bool get enabled => true;

  @override
  Future<void> send(Consultation record, Identity identity) async {
    if (client.auth.currentUser?.id != identity.userId) {
      throw StateError('Signed-in account does not match record owner.');
    }
    await client.rpc('submit_consultation', params: {'record': record.data});
  }
}
