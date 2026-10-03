# Medipop Admin

Dashboard Next.js réservé aux administrateurs d'organisation. Les pages `/`, `/entries`, `/latest` et `/export` vérifient l'utilisateur via Supabase Auth et son adhésion `admin`. Les requêtes SQL utilisent son jeton et la fonction `admin_consultations`, jamais une clé privilégiée.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Renseigner `SUPABASE_URL` et `SUPABASE_PUBLISHABLE_KEY`, puis appliquer la migration décrite dans `../docs/MIGRATION.md`. Aucune organisation réelle n'est créée par le code.

Les cookies sont HttpOnly et SameSite=Lax, Secure en production. Une nouvelle connexion est demandée à expiration du jeton. Les clients Supabase sont créés par requête: aucune session n'est partagée entre utilisateurs. Les exports JSON sont limités aux 1 000 dernières consultations de l'organisation sélectionnée; la limite est présente dans le fichier et l'interface.

Le formulaire, les transcripts et les exports ne sont pas des données de démonstration une fois connecté: contrôler l'accès au déploiement. Les anciennes prescriptions ne sont pas automatiquement migrées.

Validation: `npm run build`. Voir `../docs/VALIDATION.md` pour les résultats de ce changement.
