"""
Films importer - imports films from IMDb IDs using OMDb API.
"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Any

try:
    from scripts.importers.base import BaseImporter
except ImportError:
    from .base import BaseImporter


class FilmsImporter(BaseImporter):
    """Importer for films category."""

    def __init__(self, omdb_api_key: Optional[str] = None, api_base_url: Optional[str] = None):
        """
        Initialize films importer.

        Args:
            omdb_api_key: OMDb API key
            api_base_url: API base URL
        """
        super().__init__(
            category_id="films",
            omdb_api_key=omdb_api_key,
            api_base_url=api_base_url
        )
        self.data_file = Path(__file__).parent.parent / "data" / "films_list.json"

    def get_media_list(self) -> List[Dict[str, Any]]:
        """
        Load films list from JSON file.

        Returns:
            List of film item dictionaries
        """
        with open(self.data_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data['items']

    def build_search_query(self, metadata: Dict[str, Any]) -> str:
        """
        Build YouTube search query for a film.

        Args:
            metadata: Film metadata

        Returns:
            YouTube search query (e.g., "The Shawshank Redemption (1994) main theme")
        """
        title = metadata['title']
        year = metadata.get('year', '')
        return f"{title} ({year}) main theme"

    def fetch_metadata(self, item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Fetch film metadata from OMDb API.

        Args:
            item: Item from films_list.json with 'id' (IMDb ID) and optional 'titleVF'

        Returns:
            Metadata dictionary or None on error
        """
        if not self.omdb_client:
            raise ValueError("OMDb API key required for films import")

        imdb_id = item['id']
        metadata = self.omdb_client.fetch_by_imdb_id(imdb_id)

        if metadata:
            # Add titleVF from JSON if provided
            if 'titleVF' in item and item['titleVF']:
                metadata['titleVF'] = item['titleVF']

        return metadata


def main():
    """Run films importer standalone."""
    import argparse
    import sys

    parser = argparse.ArgumentParser(description='Import films from IMDb IDs')
    parser.add_argument('--api-key', '-k', help='OMDb API key')
    parser.add_argument('--limit', '-l', type=int, help='Limit number of films to import')
    parser.add_argument('--no-skip-existing', action='store_true', help='Re-import existing tracks')

    args = parser.parse_args()

    if not args.api_key:
        print("Error: OMDb API key required. Use --api-key or set OMDB_API_KEY environment variable.")
        sys.exit(1)

    importer = FilmsImporter(omdb_api_key=args.api_key)
    stats = importer.import_all(
        skip_existing=not args.no_skip_existing,
        max_items=args.limit
    )

    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"Total:       {stats['total']}")
    print(f"Successful:  {stats['successful']}")
    print(f"Failed:      {stats['failed']}")
    print(f"Skipped:     {stats['skipped']}")
    print(f"Duration:    {stats['duration']:.1f}s")

    if stats['errors']:
        print(f"\nErrors: {len(stats['errors'])}")
        for error in stats['errors']:
            print(f"  - {error['id']}: {error['error']}")


if __name__ == '__main__':
    main()
