# Blindtest Films

Application de blindtest musical pour films, séries, jeux vidéo et anime. Style Skribbl.io avec modes solo et multijoueur.

## 🎬 Fonctionnalités

- **Mode Solo** : Devinez le film avec un temps limité
- **Mode Multijoueur** : Jouez en temps réel avec vos amis
- **Système de score** : Points basés sur la vitesse de réponse
- **Interface Admin** : Gestion des tracks et catégories
- **Import automatique** : Scripts Python pour importer des médias depuis OMDb et YouTube

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

# Clé API OMDb (obtenir gratuitement sur http://www.omdbapi.com/apikey.aspx)
OMDB_API_KEY=votre_cle_omdb

# URL de l'API (local par défaut)
API_BASE_URL=http://localhost:3000

# Token d'import (utilise ADMIN_PASSWORD par défaut)
IMPORT_API_TOKEN=votre_mot_de_passe
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

## 📦 Hydratation de la base de données

### Importer des films

Le projet inclut un système modulaire d'import de médias.

#### Configuration des films à importer

Éditez `scripts/data/films_list.json` pour ajouter/modifier les films :

```json
{
  "version": "1.0",
  "category": "films",
  "items": [
    {
      "id": "tt0111161",
      "titleVF": "Les Évadés",
      "notes": "The Shawshank Redemption"
    }
  ]
}
```

- `id` : ID IMDb du film (format `ttXXXXXXX`)
- `titleVF` : Titre français (optionnel)
- `notes` : Notes/description (optionnel)

#### Lancer l'import

**Important** : Le serveur Next.js doit être lancé avant l'import.

Terminal 1 - Lancer le serveur :
```bash
npm run dev
```

Terminal 2 - Lancer l'import :

```bash
# Importer les 10 premiers films
python scripts/fixtures.py --categories films --limit 10

# Importer tous les films
python scripts/fixtures.py --categories films

# Importer des catégories spécifiques
python scripts/fixtures.py --categories films series
```

**Ce que fait le script :**
1. ✅ Récupère les métadonnées depuis OMDb API
2. ✅ Télécharge l'image du poster
3. ✅ Cherche et télécharge l'audio depuis YouTube
4. ✅ Génère automatiquement les variations de réponses acceptées
5. ✅ Crée le track dans la base de données
6. ✅ Skip automatiquement les films déjà importés

**Résultat :**
- Audio : `public/audio/nom-du-film.mp3`
- Image : `public/images/nom-du-film.jpg`
- Track créé avec toutes les métadonnées

### Importer d'autres catégories

Le système est modulaire et prêt pour d'autres catégories :

```bash
# Séries TV (à venir)
python scripts/fixtures.py --categories series

# Jeux vidéo (à venir)
python scripts/fixtures.py --categories jeux

# Anime (à venir)
python scripts/fixtures.py --categories anime
```

### Options avancées

```bash
# Limiter le nombre d'imports
python scripts/fixtures.py --categories films --limit 5

# Force re-import (ignore les doublons)
python scripts/fixtures.py --categories films --no-skip-existing

# Mode verbose (plus de détails)
python scripts/fixtures.py --categories films --verbose

# Dry run (prévisualisation sans import)
python scripts/fixtures.py --categories films --dry-run
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
│   ├── fixtures.py         # Orchestrateur principal
│   ├── clear_tracks.py     # Script de nettoyage
│   ├── data/               # Données source
│   │   └── films_list.json
│   ├── importers/          # Importers par catégorie
│   │   ├── base.py
│   │   └── films.py
│   └── utils/              # Utilitaires
│       ├── api_client.py
│       ├── omdb.py
│       ├── youtube.py
│       ├── answers.py
│       └── files.py
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

# 5. Importer des films (terminal 2)
python scripts/fixtures.py --categories films --limit 10

# 6. Jouer !
# Ouvrir http://localhost:3000
```

## 🐛 Troubleshooting

### Erreur "OMDB_API_KEY not set"

Solution : Ajoutez votre clé API dans `.env.local`

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
python scripts/fixtures.py --categories films
```

## 📝 Ajouter de nouveaux films

1. Trouvez l'ID IMDb sur [IMDb.com](https://www.imdb.com) (format `tt0111161`)
2. Ajoutez-le dans `scripts/data/films_list.json` :

```json
{
  "id": "tt0109830",
  "titleVF": "Forrest Gump",
  "notes": "Forrest Gump"
}
```

3. Lancez l'import :

```bash
python scripts/fixtures.py --categories films
```

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
