"""
Feeder local -> VPS : télécharge MP3/images en local, pousse vers le VPS.
À utiliser quand YouTube bloque les téléchargements depuis le VPS (IP datacenter).

Usage:
    python scripts/feeder.py scripts/data/film_v2.csv
    python scripts/feeder.py scripts/data/film_v2.csv --limit 5
    python scripts/feeder.py scripts/data/film_v2.csv --remote-url https://blindtoss.nathangracia.com
"""

import argparse
import sys
import time
from pathlib import Path

_ROOT = Path(__file__).parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

try:
    from scripts.config import AUDIO_DIR, IMAGES_DIR, FFMPEG_PATH, API_TOKEN
    from scripts.utils.csv_parser import parse_generic_csv
    from scripts.utils.youtube import YouTubeDownloader
    from scripts.utils.answers import generate_accepted_answers
    from scripts.utils.api_client import TrackAPIClient
except ImportError:
    from config import AUDIO_DIR, IMAGES_DIR, FFMPEG_PATH, API_TOKEN
    from utils.csv_parser import parse_generic_csv
    from utils.youtube import YouTubeDownloader
    from utils.answers import generate_accepted_answers
    from utils.api_client import TrackAPIClient

import requests
from slugify import slugify


def upload_file(session: requests.Session, remote_url: str, local_path: Path, file_type: str) -> 'str | None':
    """Upload un fichier local vers /api/import/upload sur le VPS. Retourne le chemin distant ou None."""
    mime = 'audio/mpeg' if file_type == 'audio' else 'image/jpeg'
    try:
        with open(local_path, 'rb') as f:
            resp = session.post(
                f"{remote_url}/api/import/upload",
                files={'file': (local_path.name, f, mime)},
                data={'type': file_type},
                timeout=180,
            )
        resp.raise_for_status()
        return resp.json()['path']
    except Exception as e:
        print(f"  [FAIL] Upload {file_type}: {e}")
        return None


def _download_url_with_thumb(
    yt: YouTubeDownloader,
    url: str,
    slug: str,
    audio_out: Path,
    image_out: Path,
) -> 'tuple[str | None, str | None]':
    """Télécharge audio depuis URL YouTube + thumbnail. Retourne (audio_path_str, image_path_str)."""
    import yt_dlp
    import requests as req

    if audio_out.exists() and image_out.exists():
        print(f"  -> Déjà téléchargé localement")
        return f"/audio/{slug}.mp3", f"/images/{slug}.jpg"

    ydl_opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3', 'preferredquality': '192'}],
        'outtmpl': str(audio_out.with_suffix('')),
        'quiet': True,
        'no_warnings': True,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'extractor_args': {'youtube': {'player_client': ['android', 'web']}},
    }
    if yt.ffmpeg_path:
        ydl_opts['ffmpeg_location'] = str(Path(yt.ffmpeg_path).parent)

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            print(f"  -> Téléchargement : {url}")
            info = ydl.extract_info(url, download=not audio_out.exists())

        if audio_out.exists():
            yt.normalize_audio_file(audio_out)
        else:
            print(f"  [FAIL] Fichier audio absent après téléchargement")
            return None, None

        # Thumbnail
        thumbnails = info.get('thumbnails', []) if info else []
        if thumbnails:
            thumb_url = sorted(thumbnails, key=lambda t: t.get('height', 0) or 0, reverse=True)[0]['url']
        else:
            thumb_url = info.get('thumbnail') if info else None

        if thumb_url and not image_out.exists():
            try:
                r = req.get(thumb_url, timeout=30)
                r.raise_for_status()
                image_out.write_bytes(r.content)
                print(f"  [OK] Thumbnail téléchargé")
            except Exception as e:
                print(f"  [WARN] Thumbnail : {e}")

        return (
            f"/audio/{slug}.mp3" if audio_out.exists() else None,
            f"/images/{slug}.jpg" if image_out.exists() else None,
        )
    except Exception as e:
        print(f"  [FAIL] Téléchargement : {e}")
        return None, None


def _cleanup(paths: list) -> None:
    for p in paths:
        if p and p.exists():
            try:
                p.unlink()
            except Exception:
                pass


def main():
    parser = argparse.ArgumentParser(
        description='Feeder local→VPS : bypass YouTube datacenter block',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemples:
  python scripts/feeder.py scripts/data/film_v2.csv
  python scripts/feeder.py scripts/data/film_v2.csv --limit 10
  python scripts/feeder.py scripts/data/film_v2.csv --keep-local
        """,
    )
    parser.add_argument('csv_file', type=Path, help='Fichier CSV à importer (format: title,titleVF,youtube_url,category_id)')
    parser.add_argument(
        '--remote-url',
        default='https://blindtoss.nathangracia.com',
        help='URL du VPS (défaut: https://blindtoss.nathangracia.com)',
    )
    parser.add_argument('--token', help='Token API (défaut: IMPORT_API_TOKEN ou ADMIN_PASSWORD dans .env)')
    parser.add_argument('--limit', '-l', type=int, help='Nombre max de tracks à traiter')
    parser.add_argument('--no-skip-existing', action='store_true', help='Réimporter les tracks déjà existants')
    parser.add_argument('--keep-local', action='store_true', help='Conserver les fichiers locaux après upload')
    args = parser.parse_args()

    if not args.csv_file.exists():
        print(f"Erreur : fichier CSV introuvable : {args.csv_file}")
        sys.exit(1)

    token = args.token or API_TOKEN
    if not token:
        print("Erreur : token API manquant. Définissez IMPORT_API_TOKEN dans .env ou passez --token")
        sys.exit(1)

    remote_url = args.remote_url.rstrip('/')

    session = requests.Session()
    session.headers['Authorization'] = f'Bearer {token}'

    api_client = TrackAPIClient(base_url=remote_url, api_token=token)
    yt = YouTubeDownloader(output_dir=AUDIO_DIR, ffmpeg_path=FFMPEG_PATH)

    # Charger les tracks existants une seule fois
    skip_existing = not args.no_skip_existing
    existing_titles: set = set()
    if skip_existing:
        print("Chargement des tracks existants depuis le VPS...")
        existing = api_client.get_tracks()
        existing_titles = {t.get('title', '').lower().strip() for t in existing}
        print(f"  {len(existing_titles)} tracks déjà présents")

    items = parse_generic_csv(args.csv_file)
    if args.limit:
        items = items[:args.limit]

    stats = {'total': len(items), 'success': 0, 'skipped': 0, 'failed': 0}
    t0 = time.time()

    print(f"\n{'='*60}")
    print(f"Feeder → {remote_url}")
    print(f"Tracks à traiter : {len(items)}")
    print(f"{'='*60}")

    for i, item in enumerate(items, 1):
        title = item['title']
        title_vf = item.get('titleVF')
        youtube_url = item.get('youtube_url')
        category_id = item['category_id']
        slug = slugify(title, separator='-', lowercase=True)

        print(f"\n[{i}/{len(items)}] {title}")

        if skip_existing and title.lower().strip() in existing_titles:
            print(f"  -> Déjà existant, ignoré")
            stats['skipped'] += 1
            continue

        audio_local = AUDIO_DIR / f"{slug}.mp3"
        image_local = IMAGES_DIR / f"{slug}.jpg"

        # Téléchargement
        if youtube_url:
            audio_str, image_str = _download_url_with_thumb(yt, youtube_url, slug, audio_local, image_local)
        else:
            print(f"  Recherche YouTube : {title} theme soundtrack...")
            audio_str, image_str = yt.download_audio_with_thumbnail(
                f"{title} theme soundtrack", slug
            )

        if not audio_local.exists():
            print(f"  [FAIL] Audio absent après téléchargement")
            stats['failed'] += 1
            continue

        # Upload audio
        print(f"  Upload audio → VPS...")
        remote_audio = upload_file(session, remote_url, audio_local, 'audio')
        if not remote_audio:
            stats['failed'] += 1
            if not args.keep_local:
                _cleanup([audio_local, image_local])
            continue

        # Upload image (optionnel)
        remote_image = None
        if image_local.exists():
            print(f"  Upload image → VPS...")
            remote_image = upload_file(session, remote_url, image_local, 'image')

        # Création du track en DB sur le VPS
        track_data = {
            'title': title,
            'acceptedAnswers': generate_accepted_answers(title, title_vf),
            'audioFile': remote_audio,
            'categoryId': category_id,
            'timeLimit': 30,
            'startTime': 0,
        }
        if title_vf:
            track_data['titleVF'] = title_vf
        if remote_image:
            track_data['imageFile'] = remote_image

        print(f"  Création track en DB...")
        result = api_client.create_track(track_data)

        if result:
            print(f"  [OK] Track créé (id: {result.get('id')})")
            stats['success'] += 1
            existing_titles.add(title.lower().strip())
        else:
            print(f"  [FAIL] Échec création track")
            stats['failed'] += 1

        if not args.keep_local:
            _cleanup([audio_local, image_local])

    duration = time.time() - t0
    print(f"\n{'='*60}")
    print(f"Terminé en {duration:.1f}s")
    print(f"  Réussi  : {stats['success']}/{stats['total']}")
    print(f"  Ignoré  : {stats['skipped']}")
    print(f"  Échoué  : {stats['failed']}")


if __name__ == '__main__':
    main()
