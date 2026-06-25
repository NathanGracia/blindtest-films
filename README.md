# Blindtest Films

Application de blindtest musical pour films, séries, jeux vidéo et anime. Style Skribbl.io avec modes solo et multijoueur.

## 🎬 Fonctionnalités

- **Mode Solo** : Devinez le film avec un temps limité
- **Mode Multijoueur** : Jouez en temps réel avec vos amis
- **Système de score** : Points basés sur la vitesse de réponse (jusqu'à 1000 pts)
- **Système de vies** : 3 vies par track pour les suggestions automatiques
- **Autocomplétion intelligente** : Suggestions de réponses en temps réel
- **Interface Admin** : Gestion des tracks et catégories
- **Import automatique** : Script Python (`feeder.py`) pour importer des médias depuis YouTube, en local puis vers le VPS
- **Normalisation audio** : Volume cohérent à -16 LUFS pour tous les tracks

## 🚀 Installation

### Prérequis

- Node.js 18+ et npm
- Python 3.10+
- FFmpeg (pour conversion audio)

### 1. Cloner le projet

```bash
git clone <votre-repo>
cd blindtest-films
```

### 2. Installer les dépendances Node.js

```bash
npm install
```

### 3. Installer les dépendances Python

```bash
pip install -r scripts/requirements.txt
```

### 4. Configuration

Créer un fichier `.env.local` à la racine :

```env
# Mot de passe admin (pour l'interface /admin)
ADMIN_PASSWORD=votre_mot_de_passe

# URL de l'API (local par défaut, port 3001)
API_BASE_URL=http://localhost:3001

# Token d'import (utilise ADMIN_PASSWORD par défaut)
IMPORT_API_TOKEN=votre_mot_de_passe

# Optionnel - clé OMDb (http://www.omdbapi.com/apikey.aspx) pour recuperer
# l'affiche officielle des films au lieu de la miniature YouTube
OMDB_API_KEY=votre_cle_omdb
```

### 5. Initialiser la base de données

```bash
npx prisma migrate deploy
npx prisma db seed
```

Cela va créer :
- La base de données SQLite (`prisma/dev.db`)
- Les tables (Category, Track)
- Les catégories de base (films, series, jeux, anime)

## 🎮 Système de gameplay

### Scoring

Le système de points est inspiré de Skribbl.io :

- **Score de base** : 100 points minimum
- **Bonus vitesse** : jusqu'à +900 points selon la rapidité
- **Formule** : `score = 100 + (900 × tempsRestant / tempsMax)`
- **Maximum** : 1000 points (réponse instantanée)
- **Multijoueur** : +200 points bonus pour le premier joueur à trouver

**Exemple** :
- Track de 30 secondes, réponse trouvée à 25s → `100 + (900 × 25/30)` = 850 points
- Premier à trouver en multijoueur → 850 + 200 = 1050 points

### Système de vies

Chaque track dispose d'un **système de 3 vies** pour limiter les tentatives via suggestions :

#### Comment ça marche ?

1. **3 vies par track** (❤️❤️❤️) - reset à chaque nouveau round
2. **Autocomplétion intelligente** : Tapez 2+ caractères pour voir les suggestions
3. **Deux types de réponses** :
   - **Sélection de suggestion** (titre exact) → Coûte 1 vie si faux ❤️ → 🖤
   - **Saisie libre** (texte personnalisé) → Aucun coût, chat public

#### Exemples

**Scénario 1 : Utilisation des suggestions**
```
Joueur tape "avatar"
→ Suggestions : "Avatar", "Avatar: The Way of Water"
→ Sélectionne "Avatar" (mauvaise réponse)
→ Perd 1 vie : ❤️❤️🖤
→ Encore 2 tentatives disponibles
```

**Scénario 2 : Saisie libre**
```
Joueur tape "c'est le film avec les aliens bleus"
→ Pas de suggestion correspondante
→ Message envoyé dans le chat public
→ Aucune vie perdue : ❤️❤️❤️
```

#### Détails techniques

- **Vérification côté serveur** : Impossible à contourner
- **Comparaison normalisée** : "Avatar" = "avatar" = "AVATAR"
- **Titres VO et VF** : Les deux comptent comme suggestions
- **0 vie** : Suggestions masquées, chat toujours actif
- **Réinitialisation** : 3 vies au début de chaque nouveau track

#### Avantages

✅ Empêche le spam de toutes les suggestions
✅ Encourage la réflexion avant de cliquer
✅ Permet toujours la discussion libre via le chat
✅ Maintient l'aspect social du jeu

### Proximité des réponses

Si votre réponse est **proche** (distance de Levenshtein ≤ 2 caractères) :
- Message privé : "🔥 Vous êtes proche !"
- Ne consomme pas de vie
- Encourage à réessayer avec une variante

**Exemples** :
- Réponse : "Avengers" → Correct : "The Avengers" → 🔥 Proche !
- Réponse : "Interstella" → Correct : "Interstellar" → 🔥 Proche !

## 📦 Hydratation de la base de données

### Importer des tracks (films, séries, jeux, anime...)

YouTube bloque les téléchargements depuis les IP datacenter (donc depuis le
VPS). `scripts/feeder.py` télécharge donc toujours en local (votre PC), puis
hydrate la BDD locale et/ou celle du VPS. Voir `scripts/CSV_IMPORT.md` pour le
détail complet.

#### Préparer un CSV

```csv
title,titleVF,youtube_url,category_id
The Shawshank Redemption,Les Évadés,https://www.youtube.com/watch?v=6hB3S9bIaco,films
Spirited Away,Le Voyage de Chihiro,,anime
```

`youtube_url` est optionnel : si vide, le script cherche automatiquement
`{title} theme soundtrack` sur YouTube.

Pour la catégorie `films`, si `OMDB_API_KEY` est configurée, l'affiche
officielle OMDb remplace automatiquement la miniature YouTube (meilleure
qualité). Désactivable avec `--no-omdb-poster`.

#### Lancer l'import

**Important** : Le serveur Next.js local doit être lancé avant l'import (pour la cible `local`).

Terminal 1 - Lancer le serveur :
```bash
npm run dev
```

Terminal 2 - Lancer l'import :

```bash
# Hydrate la BDD locale (defaut)
python scripts/feeder.py data/mon_import.csv

# Avec limite
python scripts/feeder.py data/mon_import.csv --limit 10

# Hydrate aussi le VPS (upload des fichiers + creation des tracks)
python scripts/feeder.py data/mon_import.csv --targets local vps
```

**Ce que fait le script :**
1. ✅ Télécharge l'audio + la miniature depuis YouTube (une seule fois, en local)
2. ✅ **Normalise automatiquement l'audio à -16 LUFS** (volume cohérent)
3. ✅ Génère automatiquement les variations de réponses acceptées
4. ✅ Crée le track dans la/les base(s) de données ciblée(s)
5. ✅ Skip automatiquement les tracks déjà importés (par cible)

**Résultat :**
- Audio : `public/audio/nom-du-track.mp3`
- Image : `public/images/nom-du-track.jpg`
- Track créé avec toutes les métadonnées

### Options avancées

```bash
# Limiter le nombre d'imports
python scripts/feeder.py data/mon_import.csv --limit 5

# Force re-import (ignore les doublons)
python scripts/feeder.py data/mon_import.csv --no-skip-existing

# VPS uniquement (les fichiers restent telecharges en local)
python scripts/feeder.py data/mon_import.csv --targets vps --remote-url https://blindtest.nathangracia.com
```

## 🔊 Normalisation audio

Le projet inclut un système de normalisation audio pour garantir un volume cohérent entre tous les MP3.

### Pourquoi normaliser ?

Les sources YouTube ont des volumes très hétérogènes. Sans normalisation, certains extraits sont beaucoup plus forts que d'autres, ce qui crée une expérience frustrante pour les joueurs.

### Technologie utilisée

- **Standard LUFS** (Loudness Units Full Scale) : norme de l'industrie du streaming
- **Target -16 LUFS** : même standard que YouTube, Spotify, Netflix
- **FFmpeg loudnorm filter** : normalisation perceptuelle (perception humaine du volume)
- **Préservation de la qualité** : MP3 192 kbps, pas de perte

### Auto-normalisation des nouveaux imports

✅ **Tous les nouveaux MP3 sont automatiquement normalisés** lors de l'import via `feeder.py`.

Vous verrez ce message dans les logs :
```
[OK] Audio normalized to -16 LUFS
```

### Normaliser les fichiers existants

Si vous avez déjà des MP3 importés avant cette feature, normalisez-les :

```bash
# Normaliser tous les MP3 dans public/audio/
python scripts/normalize_all_audio.py
```

## 🎮 Lancement de l'application

### Mode développement

```bash
npm run dev
```

L'application sera disponible sur [http://localhost:3000](http://localhost:3000)

### Mode production

```bash
npm run build
npm start
```

## 🔧 Outils de gestion

### Prisma Studio

Interface graphique pour visualiser/modifier la base de données :

```bash
npx prisma studio
```

Ouvre sur [http://localhost:5555](http://localhost:5555)

### Interface Admin

Accédez à [http://localhost:3000/admin/login](http://localhost:3000/admin/login)

- **Login** : Entrez le mot de passe configuré dans `ADMIN_PASSWORD`
- **Gérer les tracks** : Voir, éditer, supprimer les tracks
- **Statistiques** : Nombre de tracks par catégorie

### Script de nettoyage

Pour vider tous les tracks de la base :

```bash
python scripts/clear_tracks.py
```

## 📁 Structure du projet

```
blindtest-films/
├── app/                      # Pages Next.js
│   ├── page.tsx             # Page d'accueil
│   ├── game/                # Mode solo
│   ├── multi/               # Mode multijoueur
│   ├── admin/               # Interface admin
│   └── api/                 # Routes API
├── components/              # Composants React
├── lib/                     # Utilitaires (data, prisma)
├── prisma/                  # Schema et migrations
│   ├── schema.prisma
│   └── dev.db              # Base de données SQLite
├── public/                  # Fichiers statiques
│   ├── audio/              # Fichiers audio (.mp3)
│   └── images/             # Posters (.jpg)
├── scripts/                 # Scripts d'import Python
│   ├── config.py           # Configuration
│   ├── feeder.py            # Import CSV : telecharge YouTube en local, hydrate BDD locale et/ou VPS
│   ├── clear_tracks.py     # Script de nettoyage
│   ├── data/               # CSV source (title,titleVF,youtube_url,category_id)
│   └── utils/              # Utilitaires
│       ├── api_client.py
│       ├── youtube.py
│       ├── answers.py
│       └── csv_parser.py
└── server.js               # Serveur Socket.IO
```

## 🎯 Workflow complet de zéro

### Installation complète

```bash
# 1. Cloner et installer
git clone <repo>
cd blindtest-films
npm install
pip install -r scripts/requirements.txt

# 2. Configurer
cp .env.example .env.local
# Éditer .env.local avec vos clés

# 3. Initialiser la DB
npx prisma migrate deploy
npx prisma db seed

# 4. Lancer le serveur (terminal 1)
npm run dev

# 5. Importer des tracks (terminal 2)
python scripts/feeder.py data/mon_import.csv --limit 10

# 6. Jouer !
# Ouvrir http://localhost:3001
```

## 🐛 Troubleshooting

### Erreur "401 Unauthorized"

Solution : Vérifiez que `ADMIN_PASSWORD` est défini dans `.env.local`

### FFmpeg non trouvé

**Windows** :
```bash
winget install Gyan.FFmpeg
```

**macOS** :
```bash
brew install ffmpeg
```

**Linux** :
```bash
sudo apt install ffmpeg
```

### Téléchargement YouTube échoue

- Vérifiez votre connexion Internet
- Certaines vidéos peuvent être bloquées (le script continue avec la suivante)
- Augmentez le timeout dans `scripts/config.py`

### Doublons dans la base

```bash
# Nettoyer la base
python scripts/clear_tracks.py

# Ré-importer
python scripts/feeder.py data/mon_import.csv
```

### Volume audio incohérent

Si certains MP3 sont trop forts ou trop faibles :

```bash
# Normaliser tous les MP3 existants
python scripts/normalize_all_audio.py
```

Les nouveaux imports sont automatiquement normalisés.

## 📝 Ajouter de nouveaux tracks

Ajoutez une ligne dans votre CSV (`title,titleVF,youtube_url,category_id`) puis lancez l'import :

```bash
python scripts/feeder.py data/mon_import.csv
```

Voir `scripts/CSV_IMPORT.md` pour le format détaillé et les options (`--targets`, `--no-skip-existing`, etc.).

## 🔐 Sécurité

- **Changez `ADMIN_PASSWORD`** en production
- Les routes `/admin` et `/api/admin` sont protégées par mot de passe
- Les routes `/api/import` nécessitent un token (IMPORT_API_TOKEN)

## 🚀 Déploiement

### Vercel (recommandé)

```bash
vercel deploy
```

⚠️ **Note** : Les scripts Python ne fonctionnent pas sur Vercel. Importez les médias en local avant de déployer.

### Autre hébergement

1. Build l'application : `npm run build`
2. Déployez le dossier `.next` + `public` + `prisma`
3. Configurez les variables d'environnement
4. Lancez : `npm start`

## 📄 Licence

MIT

## 🤝 Contributions

Les contributions sont les bienvenues !

1. Fork le projet
2. Créez une branche (`git checkout -b feature/amazing-feature`)
3. Commit vos changements (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. Ouvrez une Pull Request
