# Import CSV - Guide d'utilisation

## Format du fichier CSV

Le fichier CSV doit contenir les colonnes suivantes (avec header):

```csv
title,titleVF,youtube_url,category_id
```

### Colonnes

- **title** (obligatoire): Titre original de l'œuvre
- **titleVF** (optionnel): Titre français (peut être vide)
- **youtube_url** (optionnel): Lien YouTube direct (si vide, recherche automatique)
- **category_id** (obligatoire): ID de la catégorie (`films`, `series`, `jeux`, `anime`, `dessins-animes`)

### Exemple

```csv
title,titleVF,youtube_url,category_id
The Shawshank Redemption,Les Évadés,https://www.youtube.com/watch?v=6hB3S9bIaco,films
Spirited Away,Le Voyage de Chihiro,,anime
The Legend of Zelda: Breath of the Wild,,,jeux
Breaking Bad,,,series
```

## Utilisation (scripts/feeder.py)

YouTube bloque les téléchargements depuis les IP datacenter (donc depuis le
VPS). `feeder.py` télécharge toujours les MP3/thumbnails **en local** (votre
PC), puis hydrate une ou plusieurs BDD avec les fichiers déjà téléchargés.

### Hydrater la BDD locale (par défaut)

Le serveur Next.js local doit tourner (`npm run dev`, port 3001) :

```bash
python scripts/feeder.py "data/Blind Test 2 - films_v2.csv"
python scripts/feeder.py "data/Blind Test 2 - films_v2.csv" --limit 5
python scripts/feeder.py "data/Blind Test 2 - films_v2.csv" --no-skip-existing
```

Les fichiers téléchargés sont écrits directement dans `public/audio/` et
`public/images/` du projet local, donc aucun upload n'est nécessaire pour
cette cible.

### Hydrater aussi le VPS

```bash
# Local + VPS en une seule passe (un seul telechargement par track)
python scripts/feeder.py "data/Blind Test 2 - films_v2.csv" --targets local vps

# VPS uniquement
python scripts/feeder.py "data/Blind Test 2 - films_v2.csv" --targets vps
```

Pour la cible `vps`, le script upload le MP3 + l'image vers
`/api/import/upload` (qui écrit dans le `public/` du VPS), puis crée le
track via `/api/import/tracks`.

### Options

```bash
--targets local vps     # BDD(s) a hydrater (defaut: local)
--local-url URL         # defaut: http://localhost:3001
--remote-url URL        # defaut: https://blindtoss.nathangracia.com
--local-token TOKEN     # defaut: IMPORT_API_TOKEN/ADMIN_PASSWORD du .env local
--vps-token TOKEN       # defaut: meme que --local-token
--limit N               # nombre max de tracks a traiter
--no-skip-existing      # reimporte meme si le titre existe deja sur la cible
--keep-local            # conserve les fichiers locaux meme si seul le VPS est cible
--no-omdb-poster        # utilise la miniature YouTube meme si OMDB_API_KEY est defini
```

## Fonctionnalités

### Téléchargement automatique

Le script télécharge automatiquement, une seule fois par track quelle que
soit le nombre de cibles :
- **Audio MP3** depuis YouTube (normalisé à -16 LUFS)
- **Miniature YouTube** comme image de l'œuvre (haute résolution)
- **Affiche officielle OMDb** à la place de la miniature, pour la catégorie
  `films` uniquement, si `OMDB_API_KEY` est configurée dans `.env` (sinon
  fallback silencieux sur la miniature YouTube). Désactivable avec
  `--no-omdb-poster`.

### Gestion des réponses acceptées

Les réponses acceptées sont générées automatiquement à partir de :
- Le titre original (`title`)
- Le titre français (`titleVF`) si fourni
- Variations sans articles (the, le, la, les, etc.)
- Normalisation (accents, casse)

### Gestion des doublons

Par défaut (`--skip-existing` implicite), le script vérifie pour **chaque
cible** si un track avec le même titre existe déjà (les BDD locale et VPS
sont indépendantes et peuvent diverger). Désactivable avec
`--no-skip-existing`.

## Troubleshooting

### Erreur d'authentification

Si vous obtenez une erreur 401/403 :
- Vérifiez que `IMPORT_API_TOKEN` (ou `ADMIN_PASSWORD`) est défini dans `.env`
- Pour la cible VPS, le token doit correspondre à celui configuré sur le VPS (`--vps-token` si différent du local)

### Fichier non trouvé

Les fichiers téléchargés sont stockés dans :
- Audio: `public/audio/{slug}.mp3`
- Images: `public/images/{slug}.jpg`

### YouTube download failed

- Vérifiez que `yt-dlp` est installé : `pip install yt-dlp`
- Vérifiez que `ffmpeg` est installé et dans le PATH
- Vérifiez la validité de l'URL YouTube
- Si ça échoue avec une IP datacenter (VPS), lancez `feeder.py` depuis votre PC, pas depuis le VPS — c'est exactement ce que ce script évite.

### Normalisation audio

Si la normalisation échoue :
- Installez `ffmpeg-normalize` : `pip install ffmpeg-normalize`
- L'import continuera sans normalisation si le package n'est pas installé

## Voir aussi

- `scripts/data/example_import.csv` - Fichier d'exemple
- `CLAUDE.md` - Documentation complète du projet
