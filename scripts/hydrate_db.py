#!/usr/bin/env python3
"""
Script d'hydratation de la BDD Blindtest Films
Récupère les films depuis OMDb, télécharge les thèmes musicaux depuis YouTube
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path

try:
    import requests
    from slugify import slugify
except ImportError:
    print("Dépendances manquantes. Installez-les avec:")
    print("pip install -r requirements.txt")
    sys.exit(1)

# Chemins
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_DIR = PROJECT_ROOT / "data"
AUDIO_DIR = PROJECT_ROOT / "public" / "audio"
IMAGES_DIR = PROJECT_ROOT / "public" / "images"
# Chemin vers la base de données SQLite
DB_PATH = PROJECT_ROOT / "prisma" / "dev.db"

# Films (IMDb IDs)
FILMS = [
    "tt0111161",  # The Shawshank Redemption
    "tt0068646",  # The Godfather
    "tt0468569",  # The Dark Knight
    "tt0167260",  # The Lord of the Rings: Return of the King
    "tt0137523",  # Fight Club
]

# Séries (IMDb IDs)
SERIES = [
    "tt0944947",  # Game of Thrones
    "tt0903747",  # Breaking Bad
    "tt0108778",  # Friends
    "tt0411008",  # Lost
    "tt0386676",  # The Office
    "tt0098904",  # Seinfeld
    "tt0475784",  # Westworld
    "tt2861424",  # Rick and Morty
    "tt0096697",  # The Simpsons
    "tt0141842",  # The Sopranos
    "tt0413573",  # Grey's Anatomy
    "tt0460649",  # How I Met Your Mother
    "tt1475582",  # Sherlock
    "tt0804503",  # Mad Men
    "tt0773262",  # Dexter
]


def get_omdb_api_key(cli_key: str = None):
    """Récupère la clé API OMDb (argument > env > input)"""
    if cli_key:
        return cli_key
    api_key = os.environ.get("OMDB_API_KEY")
    if not api_key:
        api_key = input("Entre ta clé API OMDb: ").strip()
    return api_key


def fetch_movie_info(imdb_id: str, api_key: str) -> dict | None:
    """Récupère les infos d'un film via OMDb API"""
    url = f"http://www.omdbapi.com/?i={imdb_id}&apikey={api_key}"
    try:
        response = requests.get(url, timeout=10)
        data = response.json()
        if data.get("Response") == "True":
            return {
                "title": data.get("Title"),
                "year": data.get("Year"),
                "poster": data.get("Poster"),
                "imdb_id": imdb_id,
            }
        else:
            print(f"  Erreur OMDb: {data.get('Error')}")
            return None
    except Exception as e:
        print(f"  Erreur requête: {e}")
        return None


def download_image(url: str, filename: str) -> str | None:
    """Télécharge une image depuis une URL"""
    if url == "N/A" or not url:
        return None

    filepath = IMAGES_DIR / filename
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        with open(filepath, "wb") as f:
            f.write(response.content)
        print(f"  Image téléchargée: {filename}")
        return f"/images/{filename}"
    except Exception as e:
        print(f"  Erreur téléchargement image: {e}")
        return None


def search_and_download_audio(title: str, filename: str) -> str | None:
    """Recherche et télécharge l'audio depuis YouTube"""
    search_query = f"{title} main theme"
    output_path = AUDIO_DIR / filename

    # Chemin ffmpeg (installé via winget)
    ffmpeg_path = Path.home() / "AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.0.1-full_build/bin"

    # Commande yt-dlp (via python -m pour éviter les problèmes de PATH)
    cmd = [
        sys.executable, "-m", "yt_dlp",
        f"ytsearch1:{search_query}",
        "-x",  # Extraire audio
        "--audio-format", "mp3",
        "--audio-quality", "192K",
        "-o", str(output_path).replace(".mp3", ".%(ext)s"),
        "--no-playlist",
        "--quiet",
        "--no-warnings",
        "--ffmpeg-location", str(ffmpeg_path),
    ]

    try:
        print(f"  Recherche YouTube: '{search_query}'...")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

        if result.returncode == 0 and output_path.exists():
            print(f"  Audio téléchargé: {filename}")
            return f"/audio/{filename}"
        else:
            print(f"  Erreur yt-dlp: {result.stderr[:200] if result.stderr else 'Fichier non créé'}")
            return None
    except subprocess.TimeoutExpired:
        print("  Timeout lors du téléchargement")
        return None
    except FileNotFoundError:
        print("  yt-dlp non trouvé. Installez-le avec: pip install yt-dlp")
        return None
    except Exception as e:
        print(f"  Erreur: {e}")
        return None


def generate_accepted_answers(title: str) -> list[str]:
    """Génère des variantes de réponses acceptées"""
    answers = set()

    # Titre original en minuscules
    lower_title = title.lower()
    answers.add(lower_title)

    # Sans "The" au début
    if lower_title.startswith("the "):
        answers.add(lower_title[4:])

    # Sans ponctuation
    no_punct = re.sub(r'[^\w\s]', '', lower_title)
    answers.add(no_punct)

    # Mots clés principaux (si titre long)
    words = lower_title.split()
    if len(words) > 2:
        # Enlever les articles
        filtered = [w for w in words if w not in ("the", "a", "an", "of", "and")]
        if filtered:
            answers.add(" ".join(filtered))

    return list(answers)


def load_existing_tracks() -> list[dict]:
    """Charge les tracks existantes via l'API"""
    try:
        response = requests.get(API_URL, timeout=10)
        if response.ok:
            return response.json()
    except Exception as e:
        print(f"Erreur chargement tracks: {e}")
    return []


def add_track_to_db(track: dict) -> bool:
    """Ajoute une track via l'API"""
    try:
        response = requests.post(API_URL, json=track, timeout=30)
        if response.ok:
            return True
        else:
            print(f"  Erreur API: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"  Erreur ajout track: {e}")
        return False


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Hydratation BDD Blindtest")
    parser.add_argument("--api-key", "-k", help="Clé API OMDb")
    parser.add_argument("--category", "-c", choices=["films", "series"], default="films",
                        help="Catégorie à hydrater (films ou series)")
    args = parser.parse_args()

    # Sélectionner la liste selon la catégorie
    if args.category == "series":
        imdb_ids = SERIES
        category_id = "series"
        category_name = "Séries"
    else:
        imdb_ids = FILMS
        category_id = "films"
        category_name = "Films"

    print("=" * 50)
    print(f"Hydratation BDD Blindtest - {category_name}")
    print("=" * 50)

    # Vérifier les dossiers
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    # Clé API
    api_key = get_omdb_api_key(args.api_key)
    if not api_key:
        print("Clé API requise!")
        sys.exit(1)

    # Charger tracks existantes via l'API
    print("\nChargement des tracks existantes...")
    tracks = load_existing_tracks()
    existing_titles = {t["title"].lower() for t in tracks}

    print(f"Tracks existantes: {len(tracks)}")
    print(f"\nTraitement de {len(imdb_ids)} {category_name.lower()}...\n")

    added_count = 0

    for i, imdb_id in enumerate(imdb_ids, 1):
        print(f"[{i}/{len(imdb_ids)}] {imdb_id}")

        # 1. Récupérer infos OMDb
        movie = fetch_movie_info(imdb_id, api_key)
        if not movie:
            continue

        title = movie["title"]
        print(f"  Titre: {title} ({movie['year']})")

        # Vérifier si déjà existant
        if title.lower() in existing_titles:
            print(f"  -> Déjà existant, ignoré")
            continue

        # Générer le slug pour les noms de fichiers
        slug = slugify(title)

        # 2. Télécharger l'image
        image_file = None
        if movie["poster"] and movie["poster"] != "N/A":
            ext = movie["poster"].split(".")[-1].split("?")[0]
            if ext not in ("jpg", "jpeg", "png"):
                ext = "jpg"
            image_file = download_image(movie["poster"], f"{slug}.{ext}")

        # 3. Télécharger l'audio
        audio_file = search_and_download_audio(title, f"{slug}.mp3")
        if not audio_file:
            print(f"  -> Audio non trouvé, film ignoré")
            continue

        # 4. Ajouter la track via l'API
        track = {
            "title": title,
            "titleVF": None,  # À remplir manuellement via l'admin
            "acceptedAnswers": generate_accepted_answers(title),
            "audioFile": audio_file,
            "imageFile": image_file,
            "categoryId": category_id,
            "timeLimit": 30,
        }

        if add_track_to_db(track):
            added_count += 1
            existing_titles.add(title.lower())
            print(f"  -> Track ajoutée à la BDD!")
        else:
            print(f"  -> Erreur lors de l'ajout")
        print()

    # Résumé
    print("=" * 50)
    print(f"Résultat: {added_count} nouvelles tracks ajoutées à la BDD")


if __name__ == "__main__":
    main()
