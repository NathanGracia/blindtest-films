"""
Script to clear all tracks from the database.
"""

import sys
import os
import argparse

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.utils.api_client import TrackAPIClient


def main():
    """Clear all tracks from database."""
    parser = argparse.ArgumentParser(description='Clear all tracks from database')
    parser.add_argument('--force', '-f', action='store_true', help='Skip confirmation prompt')
    args = parser.parse_args()

    client = TrackAPIClient()

    print("Fetching all tracks...")
    tracks = client.get_tracks()

    if not tracks:
        print("[OK] Database is already empty (no tracks found)")
        return

    print(f"Found {len(tracks)} tracks to delete")

    if not args.force:
        confirm = input(f"\nAre you sure you want to delete ALL {len(tracks)} tracks? (yes/no): ")
        if confirm.lower() not in ['yes', 'y', 'oui']:
            print("Operation cancelled")
            return

    print("\nDeleting tracks...")
    deleted = 0
    failed = 0

    for track in tracks:
        track_id = track['id']
        title = track.get('title', 'Unknown')

        if client.delete_track(track_id):
            deleted += 1
            print(f"  [OK] Deleted: {title}")
        else:
            failed += 1
            print(f"  [FAIL] Failed: {title}")

    print("\n" + "=" * 50)
    print(f"Deleted: {deleted}")
    print(f"Failed:  {failed}")
    print("=" * 50)
    print("\n[OK] Database cleared!")


if __name__ == '__main__':
    main()
