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

## Utilisation

### Import en local (développement)

```bash
# Import depuis un fichier CSV
python scripts/fixtures.py --csv data/my_import.csv

# Avec limite
python scripts/fixtures.py --csv data/my_import.csv --limit 5

# Forcer la réimportation
python scripts/fixtures.py --csv data/my_import.csv --no-skip-existing

# Exclure les titres VF des réponses acceptées
python scripts/fixtures.py --csv data/my_import.csv --no-vf-answers
```

### Import en production

Pour hydrater la base de données de production, spécifiez l'URL de l'API avec `--api-url`:

```bash
# Import vers production
python scripts/fixtures.py --csv data/my_import.csv --api-url https://blindtest.nathangracia.com

# Avec limite pour tester
python scripts/fixtures.py --csv data/my_import.csv --api-url https://blindtest.nathangracia.com --limit 3
```

## Variables d'environnement

Créez un fichier `.env` à la racine du projet avec:

```env
# Token d'authentification pour l'API (défaut: ADMIN_PASSWORD)
IMPORT_API_TOKEN=your_admin_password

# URL de l'API (optionnel, peut être override par --api-url)
API_BASE_URL=http://localhost:3000
```

## Fonctionnalités

### Téléchargement automatique

Le script télécharge automatiquement:
- **Audio MP3** depuis YouTube (normalisé à -16 LUFS)
- **Miniature YouTube** comme image de l'œuvre (haute résolution)

### Gestion des réponses acceptées

Les réponses acceptées sont générées automatiquement à partir de:
- Le titre original (`title`)
- Le titre français (`titleVF`) si fourni
- Variations sans articles (the, le, la, les, etc.)
- Normalisation (accents, casse)

**Option `--no-vf-answers`**

Par défaut, les titres VF sont inclus dans les réponses acceptées. Pour certains imports (ex: jeux vidéo où seul le titre anglais est pertinent), vous pouvez exclure les titres VF des réponses :

```bash
python scripts/fixtures.py --csv games.csv --no-vf-answers
```

⚠️ Note : Le `titleVF` reste enregistré dans la base de données, mais ne sera pas accepté comme réponse valide

### Recherche YouTube

Si `youtube_url` est vide, le script:
1. Construit une requête de recherche: `{title} theme`
2. Prend le premier résultat YouTube
3. Télécharge l'audio et la miniature

### Gestion des doublons

Par défaut (`--skip-existing`), le script:
- Vérifie si un track avec le même titre existe déjà
- Saute l'import si trouvé
- Peut être désactivé avec `--no-skip-existing`

## Exemples pratiques

### Import de films avec URLs spécifiques

```csv
title,titleVF,youtube_url,category_id
Inception,,,films
Interstellar,,,films
The Matrix,Matrix,https://www.youtube.com/watch?v=m8e-FF8MsqU,films
```

```bash
python scripts/fixtures.py --csv films.csv
```

### Import mixte multi-catégories

```csv
title,titleVF,youtube_url,category_id
The Last of Us,,,jeux
Naruto,,,anime
Game of Thrones,Le Trône de Fer,,series
The Godfather,Le Parrain,,films
```

```bash
python scripts/fixtures.py --csv mixed.csv --api-url https://blindtest.nathangracia.com
```

### Import de jeux vidéo (sans titres VF)

```csv
title,titleVF,youtube_url,category_id
The Legend of Zelda,La Légende de Zelda,,games
Final Fantasy VII,,,games
Dark Souls,,,games
```

```bash
# Les titres VF ne seront pas acceptés comme réponses
python scripts/fixtures.py --csv games.csv --no-vf-answers --api-url https://blindtest.nathangracia.com
```

### Test rapide avant production

```bash
# Tester avec 2 items en local
python scripts/fixtures.py --csv data.csv --limit 2

# Si OK, importer en production
python scripts/fixtures.py --csv data.csv --api-url https://blindtest.nathangracia.com
```

## Troubleshooting

### Erreur d'authentification

Si vous obtenez une erreur 401/403:
- Vérifiez que `IMPORT_API_TOKEN` est défini dans `.env`
- Le token doit correspondre à `ADMIN_PASSWORD` du serveur

### Fichier non trouvé

Les fichiers téléchargés sont stockés dans:
- Audio: `public/audio/{slug}.mp3`
- Images: `public/images/{slug}.jpg`

Vérifiez les permissions d'écriture sur ces dossiers.

### YouTube download failed

- Vérifiez que `yt-dlp` est installé: `pip install yt-dlp`
- Vérifiez que `ffmpeg` est installé et dans le PATH
- Vérifiez la validité de l'URL YouTube

### Normalisation audio

Si la normalisation échoue:
- Installez `ffmpeg-normalize`: `pip install ffmpeg-normalize`
- L'import continuera sans normalisation si le package n'est pas installé

## Voir aussi

- `scripts/data/example_import.csv` - Fichier d'exemple
- `CLAUDE.md` - Documentation complète du projet
