# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

Webapp perso pour gérer l'emploi à domicile de la garde d'enfant de la famille (particulier employeur, déclaration via **Pajemploi**, enfant de moins de 6 ans, pas de garde partagée).

Le propriétaire (Grégoire) n'est pas développeur : explique les étapes techniques (GitHub, Vercel, Supabase, variables d'environnement) en français, clic par clic, et écris l'interface en français.

### Utilisateurs (3)
- **La salariée (nounou)** : consulte et **valide son planning chaque fin de semaine**.
- **Les 2 parents** : corrigent si besoin, puis **clôturent le mois** pour obtenir le récap à déclarer sur Pajemploi.

### Périmètre
- **La déclaration Pajemploi est automatisée de bout en bout** (exigence du propriétaire : rien à recopier). Pajemploi n'a pas d'API ouverte aux particuliers, donc un **robot de navigation (Playwright)** remplit et envoie le formulaire sur pajemploi.urssaf.fr. Un parent déclenche l'envoi d'un clic après la clôture du mois. C'est Pajemploi qui édite le bulletin de salaire ; le robot le récupère.
- Le planning vit dans un **Google Agenda partagé** (voir Architecture).

## Règles métier (paie)

Convention collective : particuliers employeurs et emploi à domicile, **IDCC 3239**.

- **Contrat actuel** : lun., mar., jeu., ven. 16h30–18h30 (2 h) + mer. 13h30–18h30 (5 h) = **13 h/semaine**.
- **Mensualisation (année complète)** : salaire mensuel = 13 × 52 / 12 = **56,33 h × taux horaire net**, identique chaque mois. Les semaines où la famille part en vacances sans la salariée restent **payées** : ce ne sont pas des heures à retirer.
- **Ajustements du mois** (écarts entre le planning réel et le contrat, à qualifier lors de la validation) :
  - heures en plus : payées au taux normal jusqu'à 40 h/semaine, majorées au-delà (cas improbable ici) ;
  - absence de la salariée (maladie, absence non rémunérée) : déduction proportionnelle au salaire mensualisé ;
  - absence du fait des parents (vacances, annulation) : pas de déduction ;
  - congés payés de la salariée : 2,5 jours ouvrables acquis par mois (période du 1er juin au 31 mai), salaire maintenu en année complète.
- **Jours fériés, méthode exacte de déduction, liste exacte des champs du formulaire Pajemploi** : à vérifier sur les sources officielles (Pajemploi, texte de la CC 3239) avant de les coder. Ne pas improviser une règle de paie.
- Les paramètres du contrat (horaires, taux horaire, date d'effet) doivent être **versionnés par date**. Ils changeront avec les avenants, l'entrée en maternelle (septembre 2027) et le passage au CESU aux 6 ans de l'enfant.

## Architecture (cible)

- **Next.js (App Router, TypeScript)**, hébergé sur **Vercel** (déploiement automatique à chaque push sur `main`).
- **Supabase** : Postgres + connexion par lien magique (email) + Row Level Security avec 2 rôles (`parent`, `nounou`).
- **Source du planning = Google Agenda partagé**, lu via son **adresse secrète au format iCal** (pas d'OAuth Google). Cette URL est un secret, à mettre en variable d'environnement, jamais dans le code. Un événement = une plage de présence réelle. L'app compare ces plages au contrat pour détecter les écarts.
- **Calcul de paie = module TypeScript pur** (sans dépendance UI ni DB), couvert par des tests unitaires : c'est là que se trouve la valeur et le risque d'erreur.
- **Workflow** : semaine → validée par la nounou (verrouillée ensuite) → mois clôturé par un parent → clic « Déclarer » → robot Pajemploi → bulletin PDF et preuves historisés.
- **Robot Pajemploi** : script Playwright exécuté par un **workflow GitHub Actions** (`workflow_dispatch`) que l'app déclenche via l'API GitHub. Il ne tourne ni sur Vercel (Chromium y est trop lourd) ni dans les sessions Claude Code cloud (pajemploi.urssaf.fr y est bloqué par le proxy). Les identifiants Pajemploi sont stockés **uniquement dans les secrets GitHub Actions**, jamais en base ni dans le code. Le robot doit :
  - avoir un mode **dry-run** (remplit le formulaire, fait des captures d'écran, n'envoie rien) ; c'est le mode par défaut tant que le parcours n'a pas été validé en vrai ;
  - garder une capture d'écran à chaque étape et renvoyer le statut à l'app ;
  - s'arrêter net et alerter si la page ne correspond pas à ce qui est attendu (changement de site, captcha, code de double authentification). Ne jamais soumettre « à l'aveugle ».
- Le parcours exact du formulaire Pajemploi n'est pas encore cartographié : il faut des captures du parcours réel, fournies par le propriétaire, avant d'écrire les sélecteurs.

### Pièges connus
- Fuseau `Europe/Paris` partout, y compris lors des changements d'heure.
- Les événements récurrents iCal (RRULE, EXDATE, occurrences modifiées) doivent être dépliés par une librairie éprouvée, pas à la main.
- Montants stockés en centimes (entiers), arrondis uniquement à l'affichage et au récap.

## Infrastructure en place

- **Supabase** : projet `hblkhcqphgojhnxgpdpd` (NounouApp, eu-west-2), accessible via le connecteur MCP Supabase.
- **Vercel** : projet `nounouapp` (`prj_VapYmecBkpKkxIZIHKhVjznW6Qxd`, équipe `team_SGMxXsum4lWF8CjYEuyupn6p`), relié à `GregLCBG/nounouapp` : chaque push sur `main` déploie en production sur **https://nounouapp-alpha.vercel.app** (fonctions en `lhr1`, près de Supabase). Variables configurées : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (reste `GOOGLE_AGENDA_ICAL_URL`).
- **E-mails d'authentification** : le SMTP intégré de Supabase n'envoie qu'aux membres de l'organisation Supabase (erreur `email_address_not_authorized` sinon) → un SMTP personnalisé est obligatoire pour que la nounou reçoive son lien.
- **Google Agenda** : agenda dédié « Garde Blanche » sur le compte Google perso du propriétaire (ne jamais mélanger avec « Famille » : tout événement compte comme heures de garde).

## Commandes

```bash
npm run dev          # serveur local (nécessite .env.local, cf. .env.example)
npm test             # tests unitaires (vitest)
npx vitest run src/lib/paie/calcul.test.ts -t "maladie"   # un seul fichier / un seul test
npm run typecheck
npm run lint
npm run build
```

**Next.js 16** : les API diffèrent de Next 14/15 (le middleware s'appelle désormais `src/proxy.ts`, les données dynamiques doivent être sous `<Suspense>` sinon le build échoue). Lis `AGENTS.md` et la doc embarquée `node_modules/next/dist/docs/` avant d'écrire du code Next.

## Organisation du code

- `src/lib/paie/` : moteur de paie pur (dates en chaînes `YYYY-MM-DD` heure de Paris, jours fériés, calcul mensuel). Toute règle de paie passe ici, avec un test.
- `src/lib/agenda/` : lecture de l'agenda Google (iCal) → minutes de présence par jour. Les événements « journée entière » ne comptent pas comme heures.
- `src/lib/donnees.ts` : assemble contrat + motifs (Supabase) + agenda → récap du mois.
- `supabase/migrations/` : schéma SQL et RLS, appliqués sur le projet Supabase `hblkhcqphgojhnxgpdpd` via le connecteur MCP (`apply_migration`). Les fonctions d'aide RLS sont `SECURITY DEFINER`, donc rangées dans le schéma non exposé `prive`. Les comptes (3 personnes) et leur ligne `profils` sont créés à la main ; `signInWithOtp` utilise `shouldCreateUser: false`.
- Connexion par lien magique via `/auth/confirm?token_hash=…` : le modèle d'e-mail Supabase « Magic Link » doit pointer vers cette route.
