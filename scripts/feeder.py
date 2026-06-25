"""
Import de tracks : telecharge MP3 + thumbnail depuis YouTube en local (pour
contourner le blocage YouTube des IP datacenter du VPS), puis hydrate la BDD
locale et/ou la BDD du VPS (upload des fichiers + creation des tracks).

Usage:
    # Hydrate la BDD locale uniquement (defaut)
    python scripts/feeder.py data/films_v2.csv
    python scripts/feeder.py data/films_v2.csv --limit 5

    # Hydrate aussi le VPS (upload fichiers + creation tracks)
    python scripts/feeder.py data/films_v2.csv --targets local vps

    # VPS uniquement (les fichiers restent telecharges en local)
    python scripts/feeder.py data/films_v2.csv --targets vps
"""

import argparse
import sys
import time
from pathlib import Path

_ROOT = Path(__file__).parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

try:
    from scripts.config import AUDIO_DIR, IMAGES_DIR, FFMPEG_PATH, API_TOKEN, OMDB_API_KEY
    from scripts.utils.csv_parser import parse_generic_csv
    from scripts.utils.youtube import YouTubeDownloader
    from scripts.utils.answers import generate_accepted_answers
    from scripts.utils.api_client import TrackAPIClient
    from scripts.utils.omdb import OMDbClient
except ImportError:
    from config import AUDIO_DIR, IMAGES_DIR, FFMPEG_PATH, API_TOKEN, OMDB_API_KEY
    from utils.csv_parser import parse_generic_csv
    from utils.youtube import YouTubeDownloader
    from utils.answers import generate_accepted_answers
    from utils.api_client import TrackAPIClient
    from utils.omdb import OMDbClient

import requests
from slugify import slugify


def upload_file(session: requests.Session, base_url: str, local_path: Path, file_type: str) -> 'str | None':
    """Upload un fichier local vers /api/import/upload. Retourne le chemin distant ou None."""
    mime = 'audio/mpeg' if file_type == 'audio' else 'image/jpeg'
    try:
        with open(local_path, 'rb') as f:
            resp = session.post(
                f"{base_url}/api/import/upload",
                files={'file': (local_path.name, f, mime)},
                data={'type': file_type},
                timeout=180,
            )
        resp.raise_for_status()
        return resp.json()['path']
    except Exception as e:
        print(f"  [FAIL] Upload {file_type} -> {base_url}: {e}")
        return None


def _download_url_with_thumb(
    yt: YouTubeDownloader,
    url: str,
    slug: str,
    audio_out: Path,
    image_out: Path,
) -> 'tuple[str | None, str | None]':
    """Telecharge audio depuis URL YouTube + thumbnail. Retourne (audio_path_str, image_path_str)."""
    import yt_dlp
    import requests as req

    if audio_out.exists() and image_out.exists():
        print(f"  -> Deja telecharge localement")
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
            print(f"  -> Telechargement : {url}")
            info = ydl.extract_info(url, download=not audio_out.exists())

        if audio_out.exists():
            yt.normalize_audio_file(audio_out)
        else:
            print(f"  [FAIL] Fichier audio absent apres telechargement")
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
                print(f"  [OK] Thumbnail telecharge")
            except Exception as e:
                print(f"  [WARN] Thumbnail : {e}")

        return (
            f"/audio/{slug}.mp3" if audio_out.exists() else None,
            f"/images/{slug}.jpg" if image_out.exists() else None,
        )
    except Exception as e:
        print(f"  [FAIL] Telechargement : {e}")
        return None, None


def fetch_omdb_poster(omdb_client: OMDbClient, title: str, image_out: Path) -> bool:
    """Remplace image_out par l'affiche officielle OMDb si disponible. Retourne True si succes."""
    metadata = omdb_client.fetch_by_title(title)
    if not metadata or not metadata.get('poster_url'):
        return False
    try:
        r = requests.get(metadata['poster_url'], timeout=30)
        r.raise_for_status()
        image_out.write_bytes(r.content)
        print(f"  [OK] Affiche OMDb recuperee")
        return True
    except Exception as e:
        print(f"  [WARN] Telechargement affiche OMDb : {e}")
        return False


def _cleanup(paths: list) -> None:
    for p in paths:
        if p and p.exists():
            try:
                p.unlink()
            except Exception:
                pass


def build_track_data(title: str, title_vf: 'str | None', category_id: str, audio_path: str, image_path: 'str | None') -> dict:
    track_data = {
        'title': title,
        'acceptedAnswers': generate_accepted_answers(title, title_vf),
        'audioFile': audio_path,
        'categoryId': category_id,
        'timeLimit': 30,
        'startTime': 0,
    }
    if title_vf:
        track_data['titleVF'] = title_vf
    if image_path:
        track_data['imageFile'] = image_path
    return track_data


def main():
    parser = argparse.ArgumentParser(
        description='Feeder : telecharge en local depuis YouTube, hydrate la BDD locale et/ou le VPS',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemples:
  python scripts/feeder.py data/films_v2.csv
  python scripts/feeder.py data/films_v2.csv --limit 10
  python scripts/feeder.py data/films_v2.csv --targets local vps
        """,
    )
    parser.add_argument('csv_file', type=Path, help='Fichier CSV a importer (format: title,titleVF,youtube_url,category_id)')
    parser.add_argument(
        '--targets',
        nargs='+',
        choices=['local', 'vps'],
        default=['local'],
        help="BDD(s) a hydrater : 'local' (defaut), 'vps', ou les deux",
    )
    parser.add_argument('--local-url', default='http://localhost:3001', help='URL du serveur local (defaut: http://localhost:3001)')
    parser.add_argument('--remote-url', default='https://blindtoss.nathangracia.com', help='URL du VPS (defaut: https://blindtoss.nathangracia.com)')
    parser.add_argument('--local-token', help='Token API local (defaut: IMPORT_API_TOKEN ou ADMIN_PASSWORD dans .env)')
    parser.add_argument('--vps-token', help='Token API du VPS (defaut: meme que --local-token)')
    parser.add_argument('--limit', '-l', type=int, help='Nombre max de tracks a traiter')
    parser.add_argument('--no-skip-existing', action='store_true', help='Reimporter les tracks deja existants')
    parser.add_argument('--keep-local', action='store_true', help='Conserver les fichiers locaux meme si seul le VPS est cible')
    parser.add_argument('--no-omdb-poster', action='store_true', help="Ne pas remplacer l'affiche YouTube par l'affiche officielle OMDb (categorie films)")
    args = parser.parse_args()

    if not args.csv_file.exists():
        print(f"Erreur : fichier CSV introuvable : {args.csv_file}")
        sys.exit(1)

    local_token = args.local_token or API_TOKEN
    vps_token = args.vps_token or local_token
    if 'vps' in args.targets and not vps_token:
        print("Erreur : token API VPS manquant. Definissez IMPORT_API_TOKEN dans .env ou passez --vps-token")
        sys.exit(1)
    if 'local' in args.targets and not local_token:
        print("Erreur : token API local manquant. Definissez IMPORT_API_TOKEN dans .env ou passez --local-token")
        sys.exit(1)

    local_url = args.local_url.rstrip('/')
    remote_url = args.remote_url.rstrip('/')

    # Fichiers toujours conserves en local s'ils alimentent la BDD locale
    keep_local = args.keep_local or 'local' in args.targets

    clients = {}
    if 'local' in args.targets:
        clients['local'] = {
            'url': local_url,
            'api': TrackAPIClient(base_url=local_url, api_token=local_token),
            'session': None,
        }
    if 'vps' in args.targets:
        session = requests.Session()
        session.headers['Authorization'] = f'Bearer {vps_token}'
        clients['vps'] = {
            'url': remote_url,
            'api': TrackAPIClient(base_url=remote_url, api_token=vps_token),
            'session': session,
        }

    yt = YouTubeDownloader(output_dir=AUDIO_DIR, ffmpeg_path=FFMPEG_PATH)
    omdb_client = OMDbClient() if (OMDB_API_KEY and not args.no_omdb_poster) else None
    if not OMDB_API_KEY and not args.no_omdb_poster:
        print("[INFO] OMDB_API_KEY non defini - les affiches viendront des miniatures YouTube (voir .env)")

    # Charger les tracks existants une seule fois, par cible
    skip_existing = not args.no_skip_existing
    existing_titles = {name: set() for name in clients}
    if skip_existing:
        for name, client in clients.items():
            print(f"Chargement des tracks existants ({name}: {client['url']})...")
            existing = client['api'].get_tracks()
            existing_titles[name] = {t.get('title', '').lower().strip() for t in existing}
            if len(existing_titles[name]) == 0:
                print(f"  [WARN] 0 tracks recus - token incorrect ou BDD vide ?")
            else:
                print(f"  {len(existing_titles[name])} tracks deja presents")

    items = parse_generic_csv(args.csv_file)
    if args.limit:
        items = items[:args.limit]

    stats = {name: {'success': 0, 'skipped': 0, 'failed': 0} for name in clients}
    t0 = time.time()

    print(f"\n{'='*60}")
    print(f"Feeder -> cibles : {', '.join(clients.keys())}")
    print(f"Tracks a traiter : {len(items)}")
    print(f"{'='*60}")

    for i, item in enumerate(items, 1):
        title = item['title']
        title_vf = item.get('titleVF')
        youtube_url = item.get('youtube_url')
        category_id = item['category_id']
        slug = slugify(title, separator='-', lowercase=True)

        print(f"\n[{i}/{len(items)}] {title}")

        targets_needing_track = [
            name for name in clients
            if not (skip_existing and title.lower().strip() in existing_titles[name])
        ]
        if not targets_needing_track:
            print(f"  -> Deja existant sur toutes les cibles, ignore")
            for name in clients:
                stats[name]['skipped'] += 1
            continue

        audio_local = AUDIO_DIR / f"{slug}.mp3"
        image_local = IMAGES_DIR / f"{slug}.jpg"

        # Telechargement (une seule fois, partage entre les cibles)
        if youtube_url:
            _download_url_with_thumb(yt, youtube_url, slug, audio_local, image_local)
        else:
            print(f"  Recherche YouTube : {title} theme soundtrack...")
            yt.download_audio_with_thumbnail(f"{title} theme soundtrack", slug)

        if not audio_local.exists():
            print(f"  [FAIL] Audio absent apres telechargement")
            for name in targets_needing_track:
                stats[name]['failed'] += 1
            continue

        if category_id == 'films' and omdb_client:
            fetch_omdb_poster(omdb_client, title, image_local)

        for name in clients:
            if name not in targets_needing_track:
                print(f"  -> Deja existant sur {name}, ignore")
                continue

            client = clients[name]

            if name == 'local':
                # Le fichier est deja au bon endroit sur le disque local
                audio_path = f"/audio/{slug}.mp3"
                image_path = f"/images/{slug}.jpg" if image_local.exists() else None
            else:
                print(f"  Upload audio -> {name}...")
                audio_path = upload_file(client['session'], client['url'], audio_local, 'audio')
                if not audio_path:
                    stats[name]['failed'] += 1
                    continue
                image_path = None
                if image_local.exists():
                    print(f"  Upload image -> {name}...")
                    image_path = upload_file(client['session'], client['url'], image_local, 'image')

            track_data = build_track_data(title, title_vf, category_id, audio_path, image_path)

            print(f"  Creation track en DB ({name})...")
            result = client['api'].create_track(track_data)

            if result:
                print(f"  [OK] Track cree sur {name} (id: {result.get('id')})")
                stats[name]['success'] += 1
                existing_titles[name].add(title.lower().strip())
            else:
                print(f"  [FAIL] Echec creation track sur {name}")
                stats[name]['failed'] += 1

        if not keep_local:
            _cleanup([audio_local, image_local])

    duration = time.time() - t0
    print(f"\n{'='*60}")
    print(f"Termine en {duration:.1f}s")
    for name, s in stats.items():
        print(f"  [{name}] Reussi: {s['success']}  Ignore: {s['skipped']}  Echoue: {s['failed']}")


if __name__ == '__main__':
    main()
