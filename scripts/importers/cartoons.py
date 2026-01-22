"""
Cartoons importer - imports cartoons from CSV using YouTube for both audio and thumbnails.
"""

from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

try:
    from scripts.importers.base import BaseImporter
    from scripts.utils.csv_parser import parse_cartoon_csv
except ImportError:
    from .base import BaseImporter
    from ..utils.csv_parser import parse_cartoon_csv


class CartoonImporter(BaseImporter):
    """Importer for dessins-animes category using YouTube thumbnails."""

    def __init__(self, api_base_url: Optional[str] = None):
        """
        Initialize cartoons importer.

        Args:
            api_base_url: API base URL
        """
        # No OMDb needed - we use YouTube thumbnails
        super().__init__(
            category_id="dessins-animes",
            omdb_api_key=None,
            api_base_url=api_base_url
        )
        self.data_file = Path(__file__).parent.parent / "data" / "Beaucoup de dessins animés.csv"

    def get_media_list(self) -> List[Dict[str, Any]]:
        """
        Load cartoons from CSV file.

        Returns:
            List of cartoon item dictionaries
        """
        return parse_cartoon_csv(self.data_file)

    def build_search_query(self, metadata: Dict[str, Any]) -> str:
        """
        Build YouTube search query for French version.

        Args:
            metadata: Cartoon metadata

        Returns:
            YouTube search query (e.g., "Winx générique français")
        """
        title = metadata['title']

        # Always search for French version (générique français)
        return f"{title} générique français"

    def fetch_metadata(self, item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Prepare metadata from CSV item.

        Args:
            item: Item from CSV with 'title' key

        Returns:
            Metadata dictionary
        """
        title = item['title']

        # Simple metadata - thumbnail will come from YouTube
        return {
            'title': title,
            'titleVF': title,
            'year': 'Unknown',
            'poster_url': None  # Will use YouTube thumbnail instead
        }

    def download_media(self, metadata: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
        """
        Download audio and thumbnail from YouTube.

        Args:
            metadata: Metadata dictionary

        Returns:
            Tuple of (audio_path, image_path), either can be None on failure
        """
        title = metadata['title']
        slug = self.generate_slug(title)

        # Download both audio and thumbnail from YouTube
        print(f"  Downloading audio and thumbnail from YouTube...")
        search_query = self.build_search_query(metadata)
        audio_path, image_path = self.youtube_dl.download_audio_with_thumbnail(search_query, slug)

        return audio_path, image_path


def main():
    """Run cartoons importer standalone."""
    import argparse

    parser = argparse.ArgumentParser(description='Import cartoons from CSV using YouTube thumbnails')
    parser.add_argument('--limit', '-l', type=int, help='Limit number to import')
    parser.add_argument('--no-skip-existing', action='store_true',
                       help='Re-import existing tracks')

    args = parser.parse_args()

    importer = CartoonImporter()

    stats = importer.import_all(
        skip_existing=not args.no_skip_existing,
        max_items=args.limit
    )

    # Print summary
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
        for error in stats['errors'][:10]:  # Show first 10
            print(f"  - {error['id']}: {error['error']}")


if __name__ == '__main__':
    main()
