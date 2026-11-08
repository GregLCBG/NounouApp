# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

Webapp perso pour gérer l'emploi à domicile de la garde d'enfant de la famille (particulier employeur, déclaration via **Pajemploi**, enfant de moins de 6 ans, pas de garde partagée).

Le propriétaire (Grégoire) n'est pas développeur : explique les étapes techniques (GitHub, Vercel, Supabase, variables d'environnement) en français, clic par clic, et écris l'interface en français.

### Utilisateurs (3)
- **La salariée (nounou)** : consulte et **valide son planning chaque fin de semaine**.
- **Les 2 parents** : corrigent si besoin, puis **clôturent le mois** pour obtenir le récap à déclarer sur Pajemploi.

### Périmètre
- **Pas d'automatisation de pajemploi.urssaf.fr** : pas d'API ouverte aux particuliers, et un robot de navigation imposerait de stocker les identifiants URSSAF. L'app produit un **récap mensuel prêt à recopier** dans le formulaire Pajemploi. C'est Pajemploi qui édite le bulletin de salaire.
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

## Architecture (cible, pas encore implémentée)

- **Next.js (App Router, TypeScript)**, hébergé sur **Vercel** (déploiement automatique à chaque push sur `main`).
- **Supabase** : Postgres + connexion par lien magique (email) + Row Level Security avec 2 rôles (`parent`, `nounou`).
- **Source du planning = Google Agenda partagé**, lu via son **adresse secrète au format iCal** (pas d'OAuth Google). Cette URL est un secret, à mettre en variable d'environnement, jamais dans le code. Un événement = une plage de présence réelle. L'app compare ces plages au contrat pour détecter les écarts.
- **Calcul de paie = module TypeScript pur** (sans dépendance UI ni DB), couvert par des tests unitaires : c'est là que se trouve la valeur et le risque d'erreur.
- **Workflow** : semaine → validée par la nounou (verrouillée ensuite) → mois clôturé par un parent → récap Pajemploi figé et historisé.

### Pièges connus
- Fuseau `Europe/Paris` partout, y compris lors des changements d'heure.
- Les événements récurrents iCal (RRULE, EXDATE, occurrences modifiées) doivent être dépliés par une librairie éprouvée, pas à la main.
- Montants stockés en centimes (entiers), arrondis uniquement à l'affichage et au récap.

## Commandes

Projet pas encore initialisé (le dépôt ne contient que le README). Ajoute ici les commandes de dev, de build, de lint et de tests (y compris comment lancer un seul test) dès la mise en place du projet Next.js.
