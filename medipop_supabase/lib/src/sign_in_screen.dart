import 'package:flutter/material.dart';
import 'package:medipop_core/medipop_core.dart';

import 'supabase_identity.dart';

class SupabaseSignInScreen extends StatefulWidget {
  const SupabaseSignInScreen(
      {super.key, required this.provider, required this.onSignedIn});
  final SupabaseIdentity provider;
  final Future<void> Function(Identity) onSignedIn;
  @override
  State<SupabaseSignInScreen> createState() => _SupabaseSignInScreenState();
}

class _SupabaseSignInScreenState extends State<SupabaseSignInScreen> {
  final email = TextEditingController(), password = TextEditingController();
  List<Map<String, dynamic>> memberships = [];
  String? error;
  bool busy = false;

  @override
  void initState() {
    super.initState();
    // Already authenticated but several organizations: ask which one.
    if (widget.provider.client.auth.currentUser != null) _loadMemberships();
  }

  @override
  void dispose() {
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action, String failure) async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await action();
    } catch (_) {
      if (mounted) setState(() => error = failure);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _loadMemberships() => _run(() async {
        final rows = await widget.provider.memberships();
        if (rows.isEmpty) {
          throw StateError('No organization');
        }
        if (rows.length == 1) {
          await _open(rows.single['organization_id'] as String);
        } else if (mounted) {
          setState(() => memberships = rows);
        }
      }, 'No organization assigned to this account. Contact your administrator.');

  Future<void> _open(String organizationId) async {
    final identity = await widget.provider.chooseOrganization(organizationId);
    await widget.onSignedIn(identity);
  }

  Future<void> _signIn() => _run(() async {
        await widget.provider.signIn(email.text, password.text);
      }, 'Sign-in failed. Check your credentials and connection.').then((_) {
        if (error == null) return _loadMemberships();
      });

  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(title: const Text('Sign in')),
      body: Center(
          child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Your clinical workspace',
                    style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 24),
                if (error != null)
                  Text(error!,
                      style:
                          TextStyle(color: Theme.of(context).colorScheme.error)),
                if (memberships.isNotEmpty) ...[
                  const Text('Choose your organization'),
                  for (final member in memberships)
                    OutlinedButton(
                        onPressed: busy
                            ? null
                            : () => _run(
                                () => _open(member['organization_id'] as String),
                                'Cannot load this organization. Check its configuration and retry.'),
                        child: Text(
                            '${member['organization_id']} • ${member['role']}')),
                  TextButton(
                      onPressed: busy
                          ? null
                          : () async {
                              await widget.provider.signOut();
                              if (mounted) setState(() => memberships = []);
                            },
                      child: const Text('Sign out')),
                ] else ...[
                  TextField(
                      controller: email,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.username],
                      decoration: const InputDecoration(labelText: 'Email')),
                  TextField(
                      controller: password,
                      obscureText: true,
                      autofillHints: const [AutofillHints.password],
                      decoration: const InputDecoration(labelText: 'Password')),
                  const SizedBox(height: 16),
                  FilledButton(
                      onPressed: busy ? null : _signIn,
                      child: Text(busy ? 'Signing in…' : 'Sign in')),
                ],
                const SizedBox(height: 24),
                const Text(
                    'First sign-in requires Internet. Accounts are provided by your administrator.'),
              ],
            )),
      )));
}
