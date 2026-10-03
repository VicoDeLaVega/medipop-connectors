# Migration et déploiement contrôlé

Aucune commande de ce document n'a été exécutée contre un projet Supabase distant pendant l'implémentation.

## Avant la migration

- Sauvegarder la base Supabase et la base SQLite historique de chaque appareil; tester une restauration sur une copie.
- Relever les correspondances approuvées entre comptes, organisations et dossiers historiques. Ne pas attribuer automatiquement les anciens enregistrements.
- Préparer les nouveaux clients et le dashboard. Suspendre l'ancien client pendant la bascule: il ne doit plus utiliser les politiques anonymes.

## Projet Supabase de test

1. Exécuter `supabase/migrations/202609280001_organization_workspaces.sql` une seule fois, avec une connexion propriétaire de la base. Cette migration fonctionne avec ou sans l'ancienne table `prescriptions`. Elle est transactionnelle; en cas d'échec aucun changement partiel n'est conservé.
2. Créer au moins deux organisations, deux médecins et deux administrateurs dans Supabase Auth. Insérer leurs adhésions dans `organization_members` par une connexion administrative (sur un projet de test : `supabase/seed_test.sql`, après avoir adapté les quatre e-mails). Ne jamais placer une clé privilégiée dans Flutter ou le dashboard.
3. Renseigner `organizations.package` avec le JSON métier validé, ou SQL NULL pour l'exemple public.
4. Vérifier connexion, sélection d'organisation, consultation, reprise offline, expiration de session, déconnexion et changement de compte.
5. Vérifier qu'un médecin ne peut pas utiliser le dashboard/export, et qu'un administrateur ne voit jamais une autre organisation non autorisée.
6. Simuler une réponse de sync perdue puis réessayer: le même UUID doit produire un seul enregistrement. Une tentative de changer un enregistrement déjà validé avec le même UUID doit échouer.

## Historique local

L'app utilise `medipop_v3_<empreinte-compte-organisation>`. Les bases du tout premier prototype (`medipop.sqlite`, `sync_queue`) ne sont plus lues ni importées : elles ne contenaient que des données de test. Le code d'import reste disponible dans l'historique git si nécessaire.

## Historique distant

L'ancienne table `prescriptions` est conservée mais ses accès clients sont révoqués. Ses lignes ne sont pas automatiquement copiées. L'opérateur doit préparer une correspondance approuvée et une migration dédiée avant de les exposer dans `consultations`; tenir compte des lignes déjà importées depuis les appareils pour éviter les doublons métier. Le nouvel UUID protège les retries d'une même importation, pas deux migrations indépendantes d'un même dossier.

## Retour arrière

En cas de problème, arrêter les synchronisations et l'administration, conserver toutes les nouvelles bases/outbox et la sauvegarde initiale. Revenir au code précédent uniquement pour analyse sur copie locale. Ne pas restaurer les politiques de lecture ou d'insertion anonymes. Une restauration de base distante nécessite une décision opérateur tenant compte des nouveaux enregistrements créés depuis la sauvegarde.

## Validation effectuée

Le test `tool/verify_rls.mjs` exécute la migration sur PostgreSQL embarqué (PGlite), avec rôles et fonction `auth.uid()` de test. Il couvre les droits et la transaction SQL, pas l'ensemble de Supabase Auth/PostgREST. Les étapes sur appareil et sur projet Supabase de test restent nécessaires avant production.
