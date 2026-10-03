import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:http/http.dart' show ClientException;
import 'package:medipop_core/medipop_core.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'sign_in_screen.dart';

/// True for failures that mean "no network", as opposed to "not allowed".
bool isNetworkError(Object e) =>
    e is ClientException ||
    e is SocketException ||
    e is TimeoutException ||
    e is AuthRetryableFetchException;

/// Supabase Auth (email/password) with server-side organization membership
/// (`organization_members`). Neither role nor organization from the client is
/// trusted: both are re-read from the server whenever the network allows.
class SupabaseIdentity implements IdentityProvider {
  SupabaseIdentity(this.client);
  final SupabaseClient client;

  @override
  bool get requiresSignIn => true;

  String _cacheKey(String userId) => 'medipop_supabase_identity_$userId';

  @override
  Stream<void> get signedOut => client.auth.onAuthStateChange
      .where((s) => s.event == AuthChangeEvent.signedOut)
      .map((_) {});

  /// Memberships of the signed-in user, verified online.
  Future<List<Map<String, dynamic>>> memberships() async {
    final userId = client.auth.currentUser?.id;
    if (userId == null) return const [];
    final rows = await client
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', userId);
    return List<Map<String, dynamic>>.from(rows);
  }

  @override
  Future<Identity?> restore() async {
    final userId = client.auth.currentUser?.id;
    if (userId == null) return null;
    final prefs = await SharedPreferences.getInstance();
    final cached = prefs.getString(_cacheKey(userId));
    try {
      if (client.auth.currentSession?.isExpired == true) {
        await client.auth.refreshSession();
      }
      await client.auth.getUser().timeout(const Duration(seconds: 15));
      final rows = await memberships();
      if (rows.isEmpty) {
        await prefs.remove(_cacheKey(userId));
        throw StateError('No organization assigned. Contact your administrator.');
      }
      final selected = cached == null
          ? null
          : (jsonDecode(cached) as Map)['organizationId'] as String?;
      final match = rows.where((m) => m['organization_id'] == selected);
      if (match.isEmpty && rows.length > 1) return null; // Ask on sign-in screen.
      return chooseOrganization(
          (match.isNotEmpty ? match.first : rows.first)['organization_id']
              as String);
    } catch (e) {
      if (!isNetworkError(e)) rethrow;
      if (cached == null) {
        throw StateError('First sign-in and configuration require Internet.');
      }
      final identity = Identity.fromJson(jsonDecode(cached));
      if (identity.userId != userId) throw StateError('Invalid identity cache.');
      return identity;
    }
  }

  Future<void> signIn(String email, String password) =>
      client.auth.signInWithPassword(email: email.trim(), password: password);

  /// Verifies membership on the server before opening the organization.
  Future<Identity> chooseOrganization(String organizationId) async {
    final userId = client.auth.currentUser!.id;
    final member = await client
        .from('organization_members')
        .select('role')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .single();
    final identity = Identity(
        userId: userId,
        organizationId: organizationId,
        role: member['role'] as String);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_cacheKey(userId), jsonEncode(identity.toJson()));
    return identity;
  }

  @override
  Widget buildSignIn(
          BuildContext context, Future<void> Function(Identity) onSignedIn) =>
      SupabaseSignInScreen(provider: this, onSignedIn: onSignedIn);

  @override
  Future<bool> authorize(Identity identity) async {
    if (client.auth.currentUser?.id != identity.userId) return false;
    if (client.auth.currentSession?.isExpired != false) return false;
    final membership = await client
        .from('organization_members')
        .select('role')
        .eq('user_id', identity.userId)
        .eq('organization_id', identity.organizationId)
        .maybeSingle();
    if (membership == null || membership['role'] != identity.role) {
      // Revoked or changed: close the workspace rather than sync under stale rights.
      await signOut();
      return false;
    }
    return true;
  }

  @override
  Future<void> signOut() async {
    final userId = client.auth.currentUser?.id;
    if (userId != null) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_cacheKey(userId));
    }
    try {
      await client.auth.signOut(scope: SignOutScope.local);
    } catch (_) {}
  }
}
