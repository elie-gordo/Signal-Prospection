# Signal — prospection par signaux d'achat

> Trouver les entreprises qui ont besoin d'un site ou d'une automatisation **maintenant**, et savoir **pourquoi** avant même de leur écrire.

Signal est un outil de prospection B2B que j'utilise au quotidien en tant que développeur freelance, et un projet de portfolio. Chaque matin, il collecte des données publiques, les enrichit, audite les sites web, attribue un score explicable à chaque opportunité et range le tout dans un dashboard.

![Next.js](https://img.shields.io/badge/Next.js-15-black) ![React](https://img.shields.io/badge/React-19-149eca) ![Python](https://img.shields.io/badge/Python-3.11-3776ab) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791) ![Docker](https://img.shields.io/badge/Docker-Compose-2496ed) ![Tests](https://img.shields.io/badge/tests-54%20passing-2f6b57)

---

## Sommaire

- [Pourquoi ce projet](#pourquoi-ce-projet)
- [Ce que fait l'outil](#ce-que-fait-loutil)
- [Architecture](#architecture)
- [Le pipeline, étape par étape](#le-pipeline-étape-par-étape)
- [Le scoring](#le-scoring)
- [Le dashboard](#le-dashboard)
- [Installation](#installation)
- [Utilisation](#utilisation)
- [Décisions et leçons apprises](#décisions-et-leçons-apprises)
- [Cadre légal](#cadre-légal)
- [Prochaines mises à jour](#prochaines-mises-à-jour)

---

## Pourquoi ce projet

La prospection classique consiste à acheter ou scraper une liste, puis à envoyer le même message à tout le monde. Le taux de réponse est faible parce que le message arrive au mauvais moment, sans raison.

Signal part d'une autre idée : **une entreprise a besoin d'un prestataire web à des moments précis**. Ces moments laissent des traces publiques :

| Signal | Ce qu'il révèle | Source |
|---|---|---|
| Une entreprise vient d'être immatriculée | Elle n'a souvent ni site, ni outils, ni prestataire | BODACC (open data) |
| Un projet web ou IA est publié | Le besoin est exprimé, avec un budget | Codeur.com (flux RSS public) |
| Le site existant est lent, non sécurisé ou pas responsive | Il dessert l'entreprise | Audit automatique |

Chaque lead arrive donc avec **la raison pour laquelle il mérite un message**, ce qui permet d'écrire quelque chose de personnel plutôt qu'un template.

---

## Ce que fait l'outil

- **Collecte** chaque jour les créations d'entreprises du BODACC (Paris et petite couronne) et les projets Codeur.com.
- **Enrichit** chaque SIREN via l'API publique Recherche d'entreprises : code NAF, adresse, dirigeant, effectif, date de création.
- **Cherche le site web** via un moteur de recherche local (SearXNG) et ne le retient que s'il prouve appartenir à l'entreprise.
- **Audite** les sites trouvés : HTTPS, vitesse, poids, responsive, CMS, copyright figé.
- **Extrait les contacts publics** (email, téléphone) depuis le site et ses pages contact ou mentions légales.
- **Score** chaque lead sur 100 avec un barème transparent : chaque point est justifié dans la fiche.
- **Affiche** le tout dans un dashboard : leads chauds, filtres, statuts de pipeline (qualifié, contacté, gagné), notes.
- **Tourne seul** : un conteneur Docker relance la chaîne tous les jours à 07:00.

---

## Architecture

```mermaid
flowchart LR
    subgraph Sources publiques
        B[BODACC<br/>API open data]
        C[Codeur.com<br/>flux RSS]
        R[API Recherche<br/>d'entreprises]
    end

    subgraph Docker
        W[Worker Python<br/>daemon 07:00]
        S[SearXNG<br/>recherche locale]
        DB[(PostgreSQL 16)]
    end

    B --> W
    C --> W
    R --> W
    W <--> S
    W --> WEB[Sites des entreprises]
    W --> DB
    DB --> N[Dashboard Next.js<br/>localhost:3100]
```

Deux mondes séparés qui partagent un seul schéma SQL :

- **`workers/`** (Python) : tout ce qui touche au réseau, collecte, enrichissement, audit, scoring. Python est le bon outil pour le scraping et le parsing HTML (`httpx`, `selectolax`).
- **`web/`** (Next.js) : uniquement la lecture des leads et la mise à jour des statuts. Aucun appel réseau sortant, le dashboard reste rapide et simple.
- **`db/schema.sql`** : le contrat entre les deux. Les migrations sont idempotentes (`CREATE ... IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).

```
.
├── db/schema.sql              # schéma partagé (companies, leads, site_audits, messages, collector_runs)
├── docker-compose.yml         # db + searxng + worker
├── searxng/settings.yml       # moteur de recherche local (sortie JSON, sans limiteur)
├── workers/                   # package Python `prospect_workers`
│   ├── src/prospect_workers/
│   │   ├── cli.py             # commande `prospect`
│   │   ├── collectors/        # bodacc.py, codeur.py
│   │   ├── enrich/            # recherche_entreprises.py, discovery.py, contacts.py
│   │   ├── audit/site.py      # audit technique d'un site
│   │   └── scoring.py         # barème explicable
│   └── tests/                 # 42 tests pytest
└── web/                       # dashboard Next.js 15 / React 19 / Tailwind v4
    └── src/
        ├── app/               # /, /leads, /leads/[id], /methode
        ├── components/        # graphiques, lignes de leads, badges
        └── lib/data/          # dépôt postgres + dépôt démo (fixtures fictives)
```

---

## Le pipeline, étape par étape

La commande `prospect run` exécute les étapes dans l'ordre. Chacune est aussi lançable seule.

### 1. Collecter

- **BODACC** : l'API opendatasoft est interrogée sur les avis de la famille `creation`, filtrés par département, sur une fenêtre glissante de 2 jours. L'édition du jour paraît en général après 07:00 : elle est récupérée au run du lendemain, sans perte.
- **Codeur.com** : le flux RSS public des projets, filtré par mots-clés (site, Shopify, React, n8n, IA, chatbot...). Les entités HTML des titres sont décodées.
- La déduplication repose sur la contrainte `UNIQUE (source, external_id)` : relancer la collecte ne crée jamais de doublon.

### 2. Enrichir

Chaque SIREN est complété via l'API gouvernementale [Recherche d'entreprises](https://recherche-entreprises.api.gouv.fr) : NAF, adresse, code postal, dirigeant, tranche d'effectif, date de création.

### 3. Découvrir le site web

C'est la partie la plus délicate. Une recherche « nom + ville » renvoie souvent des homonymes ou des annuaires. Trois filtres successifs :

1. **Liste noire** : annuaires et réseaux sociaux (Pages Jaunes, Facebook, LinkedIn, Yelp...) écartés.
2. **Similarité du domaine** : le domaine doit ressembler au nom de l'entreprise (ratio supérieur ou égal à 0,8, mots génériques ignorés).
3. **Preuve de propriété** : la page doit afficher le **SIREN**, ou le **code postal et le nom de la rue**. Sans preuve, le site est rejeté.

Sur les premiers tests, cette dernière règle a retiré 8 faux sites sur 12, qui auraient produit de faux diagnostics (« site faible » alors que ce n'était pas le leur).

### 4. Auditer

Chaque site part de 100 points, puis subit des pénalités :

| Problème | Pénalité |
|---|---|
| Site inaccessible | -100 |
| Pas de HTTPS | -25 |
| Chargement très lent | -25 |
| Pas responsive (meta viewport absente) | -25 |
| Chargement lent | -15 |
| Copyright figé depuis plusieurs années | -10 |
| Page HTML lourde | -10 |
| Balise title manquante | -5 |
| Site construit avec Wix ou Jimdo | -5 |

### 5. Extraire les contacts

Email et téléphone sont cherchés sur la page d'accueil puis sur deux pages au maximum parmi les pages contact et mentions légales. La regex de téléphone est bornée pour ne pas confondre un identifiant (un EUID comme `FR7501.130879166`) avec un numéro.

### 6. Scorer

Voir la section suivante.

---

## Le scoring

Le score va de 0 à 100. **Chaque règle produit une raison lisible**, stockée en JSON et affichée dans la fiche du lead. Pas de boîte noire : on sait toujours pourquoi un lead est en haut de la liste. Un lead est « chaud » à partir de 70.

### Nouvelle entreprise (BODACC)

| Règle | Points |
|---|---|
| Nouvelle activité immatriculée (base) | +25 |
| Aucun site web trouvé (seulement si une recherche a eu lieu) | +25 |
| Secteur cible (restauration, beauté, sport, commerce physique, BTP, santé) | +20 |
| Site faible (audit < 50) | +20 |
| Site perfectible (audit < 75) | +10 |
| Contactable (email ou téléphone) | +10 |
| Créée il y a moins de 30 jours | +10 |
| Entrepreneur individuel | -5 |
| Entreprise existante (créée il y a plus d'un an) | -10 |
| Hors cible (livreurs, VTC, immobilier, holdings, vente à distance) | -40 |

### Projet publié (Codeur)

| Règle | Points |
|---|---|
| Projet publié, besoin exprimé (base) | +40 |
| Besoin automatisation / IA | +20 |
| Budget élevé (≥ 5 000 €) | +20 |
| Besoin web / e-commerce | +15 |
| Budget correct (≥ 1 000 €) | +10 |
| Publié il y a moins de 24 h | +10 |
| Publié il y a plus de 7 jours | -15 |
| Hors cœur de métier (logo, traduction, rédaction, Google Ads...) | -40 |

Les secteurs ciblés et exclus se règlent dans `.env` (`TARGET_NAF_PREFIXES`, `EXCLUDED_NAF_PREFIXES`) sans toucher au code.

---

## Le dashboard

Direction visuelle « signal desk » : papier et encre, un seul accent orange réservé aux signaux forts, Instrument Serif pour les titres et Geist pour le texte, grain de papier discret, thème sombre automatique.

| Page | Contenu |
|---|---|
| `/` | KPI (total, 7 derniers jours, leads chauds, contactés, gagnés), activité sur 14 jours, distribution des scores, top leads, état des derniers runs |
| `/leads` | Liste filtrable (source, signal, statut, score minimum, recherche texte), pagination, filtres conservés dans l'URL |
| `/leads/[id]` | Fiche complète : décomposition du score, entreprise, audit du site, contacts cliquables (`mailto:`, `tel:`), changement de statut et notes |
| `/methode` | Explication du fonctionnement, pensée pour un visiteur du portfolio |

### Deux sources de données

Le dashboard passe par une interface `LeadRepository` avec deux implémentations :

- **`postgres`** : les vraies données, en lecture et écriture. Usage local uniquement.
- **`demo`** : 110 leads fictifs en lecture seule, pour une démo publique sans exposer de données réelles. Noms inventés, SIREN en `9xxxxxxxx`, domaines `.example`, téléphones dans la plage ARCEP réservée à la fiction (`01 99 00 xx xx`).

On bascule de l'une à l'autre avec `DATA_SOURCE=postgres` ou `DATA_SOURCE=demo`.

---

## Installation

### Prérequis

- Docker Desktop
- Node.js 20+ et pnpm
- Python 3.11+ et [uv](https://docs.astral.sh/uv/) (seulement pour lancer les workers hors Docker)

### 1. Configurer

```bash
cp .env.example .env
# générer un secret pour SearXNG, puis le coller dans SEARXNG_SECRET
python -c "import secrets; print(secrets.token_hex(32))"
```

Variables principales :

| Variable | Rôle | Valeur par défaut |
|---|---|---|
| `TARGET_DEPARTMENTS` | Départements surveillés | `75,92,93,94` |
| `TARGET_NAF_PREFIXES` | Secteurs bonifiés | `56,9602,9604,9313,47,43,8690` |
| `EXCLUDED_NAF_PREFIXES` | Secteurs pénalisés | livreurs, VTC, immobilier, holdings... |
| `CODEUR_KEYWORDS` | Mots-clés des projets Codeur | `site,web,shopify,n8n,ia,...` |
| `RUN_AT` | Heure du run quotidien (Europe/Paris) | `07:00` |

### 2. Lancer la base, la recherche et le worker

```bash
docker compose up -d --build
```

Le worker applique le schéma au démarrage, puis exécute la chaîne complète chaque jour à `RUN_AT`.

### 3. Lancer le dashboard

```bash
cd web
echo "DATABASE_URL=postgresql://prospect:prospect@localhost:5433/prospect" > .env.local
echo "DATA_SOURCE=postgres" >> .env.local
pnpm install
pnpm build
pnpm start --port 3100
```

Ouvrir http://localhost:3100. Pour la démo avec données fictives, remplacer par `DATA_SOURCE=demo` (pas besoin de base).

---

## Utilisation

### Commandes du worker

```bash
# dans le conteneur
docker compose exec worker prospect run

# ou en local
cd workers && uv sync && uv run prospect run
```

| Commande | Effet |
|---|---|
| `prospect migrate` | Applique `db/schema.sql` |
| `prospect collect bodacc --days 7` | Collecte BODACC sur 7 jours |
| `prospect collect codeur` | Collecte les projets Codeur |
| `prospect enrich` | Complète les SIREN |
| `prospect discover` | Cherche les sites web |
| `prospect audit` | Audite les sites trouvés |
| `prospect contacts` | Extrait emails et téléphones |
| `prospect score` | Recalcule tous les scores |
| `prospect run` | Toute la chaîne une fois |
| `prospect daemon --at 07:00` | Toute la chaîne chaque jour à heure fixe |

### Routine quotidienne

1. Ouvrir le dashboard le matin : les leads chauds sont en tête.
2. Lire la décomposition du score pour comprendre le besoin.
3. Passer le lead en « Qualifié », écrire un message qui cite le signal, puis le passer en « Contacté ».
4. Noter les réponses et les rendez-vous dans les notes du lead.

### Tests

```bash
cd workers && uv run pytest                        # 42 tests
cd web && pnpm test                                # 12 tests
cd web && pnpm lint && pnpm exec tsc --noEmit      # lint + typecheck
```

---

## Décisions et leçons apprises

**Pourquoi Next.js + Python plutôt qu'un seul langage ?**
Le scraping, le parsing HTML et les appels aux API publiques sont plus simples et plus robustes en Python. Le dashboard profite des Server Components et des Server Actions de Next.js : pas d'API REST à maintenir, le rendu se fait côté serveur directement depuis PostgreSQL.

**Pourquoi un SearXNG local ?**
DuckDuckGo a bloqué la recherche de sites après deux requêtes, et Brave aussi. Un SearXNG auto-hébergé agrège plusieurs moteurs et répartit la charge : la découverte de sites tourne sans clé API et sans coût.

**Pourquoi exiger une preuve de propriété du site ?**
La première version prenait le premier résultat dont le domaine ressemblait au nom. Résultat : des restaurants homonymes dans d'autres villes, des marques sans rapport. Un faux site produit un faux diagnostic, et un message de prospection faux détruit la crédibilité. Exiger le SIREN ou l'adresse sur la page a éliminé ces erreurs.

**Pourquoi le bonus « Aucun site » n'est accordé qu'après recherche ?**
Sinon toute entreprise pas encore traitée paraissait « sans site » et remontait à tort en tête de liste.

**Pourquoi avoir retiré Welcome to the Jungle, Pages Jaunes et Malt ?**
Ils étaient prévus au départ. WTTJ et Pages Jaunes renvoient des 403 anti-bot, et leurs CGU interdisent le scraping. Malt n'expose aucune liste publique de projets. Plutôt que d'afficher des sources vides, elles ont été retirées.

**Pourquoi un daemon Python plutôt qu'un cron ?**
Un seul conteneur, un fuseau horaire explicite (`TZ=Europe/Paris`), aucune dépendance au planificateur de l'OS hôte. Ça tourne pareil sous Windows, macOS ou sur un VPS.

### Ce que montrent les vraies données

Sur 3 jours de BODACC en Île-de-France (environ 1 500 créations) :

- La majorité des créations sont hors cible : vente en ligne (340), livreurs (315), immobilier (127).
- Environ 80 entreprises tombent dans les secteurs ciblés, dont une large part d'entrepreneurs individuels.
- Les entreprises tout juste créées ont **rarement un site ou un contact public**. C'est précisément le besoin, mais c'est aussi la limite actuelle de l'outil : il faut une autre source pour les joindre (voir la feuille de route).

Les leads Codeur sont, eux, directement exploitables : le besoin, le budget et le lien de réponse sont fournis.

---

## Cadre légal

- **Uniquement des données publiques et ouvertes** : BODACC et Recherche d'entreprises sont en open data (licence ouverte Etalab), le flux RSS de Codeur est public.
- **Pas de scraping des plateformes qui l'interdisent** : LinkedIn, Pages Jaunes et WTTJ sont exclus.
- **RGPD et démarchage B2B** : l'email professionnel est admis au titre de l'intérêt légitime, à condition que le message soit en rapport avec l'activité de la personne et contienne un lien de désinscription. Pas de SMS ni d'appel automatisé vers des numéros personnels.
- **Sécurité** : les Server Actions n'ont pas d'authentification. Le mode `postgres` ne doit **jamais** être exposé publiquement. Seul le mode `demo` est fait pour être mis en ligne.

---

## Prochaines mises à jour

Classées par impact sur le chiffre d'affaires.

### Priorité 1 : rendre les leads joignables

- **Google Places API** : récupérer le téléphone et le site des commerces physiques (restaurants, salons, boutiques), qui ont presque tous une fiche Google. C'est le plus gros levier : aujourd'hui, seules 2 entreprises sur 1 494 ont un contact.
- **Lien LinkedIn manuel** : générer depuis la fiche une recherche LinkedIn pré-remplie avec le nom du dirigeant. Aucun scraping, un clic pour trouver la personne.
- **Réintégrer la vente en ligne (NAF 47.91)** comme cible Shopify dédiée, avec son propre barème. C'est la plus grosse catégorie de créations.

### Priorité 2 : passer du lead au message

- **Brouillons rédigés par Claude** : à partir du signal, de l'audit et du secteur, générer un premier message personnalisé dans la table `messages`, déjà prévue dans le schéma.
- **Validation par Telegram** : recevoir chaque matin les 5 meilleurs leads avec leur brouillon, et approuver ou rejeter en un tap.
- **Envoi et suivi** : envoi des emails approuvés avec lien de désinscription, détection des réponses, relance automatique à J+4.

### Priorité 3 : nouvelles sources de signaux

- **Marchés publics (BOAMP)** : appels d'offres web des collectivités et établissements publics, via API ouverte.
- **Modifications BODACC** : transferts de siège, changements de dirigeant ou d'activité, signes d'un besoin de refonte.
- **Offres d'emploi via l'API France Travail** : une PME qui recrute un développeur ou un chargé de communication digitale a un projet en cours.
- **Autres plateformes freelance** à flux public, sur le modèle de Codeur.

### Priorité 4 : qualité et pilotage

- **Taux de conversion par règle de scoring** : mesurer quelles règles mènent vraiment à des rendez-vous, puis ajuster les points à partir des résultats réels.
- **Audit plus profond** : Lighthouse (Core Web Vitals, accessibilité, SEO) pour des diagnostics plus précis dans les messages.
- **Alerte en cas d'échec d'un run** (Telegram), avec relance automatique.
- **Authentification** sur le dashboard pour l'héberger sur un VPS et y accéder depuis le téléphone.

### Priorité 5 : portfolio

- **Déployer la démo** sur Vercel en `DATA_SOURCE=demo`.
- **Captures et GIF** du dashboard dans ce README.
- **CI GitHub Actions** : tests Python, tests web, lint et build à chaque push.

---

## Auteur

**Elliott Lanza**, développeur full-stack freelance spécialisé dans l'intégration IA et l'automatisation.
GitHub : [@elie-gordo](https://github.com/elie-gordo)
