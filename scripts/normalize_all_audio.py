"""
Script pour normaliser tous les fichiers audio existants à -16 LUFS.
Parcourt le dossier public/audio/ et normalise tous les MP3.
"""

import sys
import os
from pathlib import Path
from tqdm import tqdm

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.config import AUDIO_DIR
from scripts.utils.youtube import YouTubeDownloader


def normalize_all_audio(skip_existing: bool = False):
    """
    Normalise tous les fichiers audio du dossier public/audio.

    Args:
        skip_existing: Si True, saute les fichiers déjà normalisés (non implémenté pour l'instant)
    """
    # Initialiser le downloader (qui contient la fonction de normalisation)
    downloader = YouTubeDownloader()

    # Trouver tous les fichiers MP3
    audio_files = list(AUDIO_DIR.glob('*.mp3'))

    if not audio_files:
        print(f"Aucun fichier audio trouvé dans {AUDIO_DIR}")
        return

    print(f"\n{'=' * 60}")
    print(f"Normalisation de {len(audio_files)} fichiers audio")
    print(f"Dossier: {AUDIO_DIR}")
    print(f"Cible: -16 LUFS (EBU R128)")
    print(f"{'=' * 60}\n")

    stats = {
        'total': len(audio_files),
        'success': 0,
        'failed': 0,
        'skipped': 0,
    }

    # Normaliser chaque fichier avec barre de progression
    for audio_file in tqdm(audio_files, desc="Normalisation", unit="fichier"):
        try:
            print(f"\n[{stats['success'] + stats['failed'] + 1}/{stats['total']}] {audio_file.name}")

            success = downloader.normalize_audio_file(audio_file)

            if success:
                stats['success'] += 1
            else:
                stats['failed'] += 1

        except Exception as e:
            print(f"  [ERROR] {e}")
            stats['failed'] += 1

    # Afficher le résumé
    print(f"\n{'=' * 60}")
    print(f"Résumé de la normalisation")
    print(f"{'=' * 60}")
    print(f"Total:       {stats['total']}")
    print(f"Succès:      {stats['success']}")
    print(f"Échecs:      {stats['failed']}")
    print(f"Ignorés:     {stats['skipped']}")
    print(f"{'=' * 60}\n")

    if stats['failed'] > 0:
        print("⚠️  Certains fichiers n'ont pas pu être normalisés.")
        print("   Assurez-vous que ffmpeg et ffmpeg-normalize sont installés :")
        print("   pip install ffmpeg-normalize")

    if stats['success'] > 0:
        print(f"✅ {stats['success']} fichiers normalisés avec succès à -16 LUFS !")


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(
        description='Normalise tous les fichiers audio à -16 LUFS',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemples:
  # Normaliser tous les fichiers audio
  python scripts/normalize_all_audio.py

Prérequis:
  - ffmpeg installé (https://ffmpeg.org/download.html)
  - ffmpeg-normalize installé: pip install ffmpeg-normalize
        """
    )

    parser.add_argument(
        '--skip-existing',
        action='store_true',
        help='Ignorer les fichiers déjà normalisés (non implémenté)'
    )

    args = parser.parse_args()

    try:
        normalize_all_audio(skip_existing=args.skip_existing)
    except KeyboardInterrupt:
        print("\n\n⚠️  Normalisation interrompue par l'utilisateur")
    except Exception as e:
        print(f"\n❌ Erreur: {e}")
        import traceback
        traceback.print_exc()
