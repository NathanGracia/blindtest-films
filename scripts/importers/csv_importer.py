"""
Generic CSV importer - imports media from CSV file.
CSV format: title,titleVF,youtube_url,category_id
"""

from pathlib import Path
from typing import Dict, List, Optional, Any

try:
    from scripts.importers.base import BaseImporter
    from scripts.utils.csv_parser import parse_generic_csv
    from scripts.config import IMAGES_DIR
    from scripts.utils.files import download_image
except ImportError:
    from .base import BaseImporter
    from ..utils.csv_parser import parse_generic_csv
    from ..config import IMAGES_DIR
    from ..utils.files import download_image


class CSVImporter(BaseImporter):
    """Importer for generic CSV files."""

    def __init__(self, csv_file: Path, category_id: Optional[str] = None, api_base_url: Optional[str] = None):
        """
        Initialize CSV importer.

        Args:
            csv_file: Path to CSV file
            category_id: Override category ID (if not using CSV column)
            api_base_url: API base URL
        """
        # Use 'csv' as placeholder category - actual category comes from CSV
        super().__init__(
            category_id=category_id or "csv",
            api_base_url=api_base_url
        )
        self.csv_file = csv_file
        self.override_category = category_id

    def get_media_list(self) -> List[Dict[str, Any]]:
        """
        Load media list from CSV file.

        Returns:
            List of media item dictionaries
        """
        return parse_generic_csv(self.csv_file)

    def build_search_query(self, metadata: Dict[str, Any]) -> str:
        """
        Build YouTube search query.

        Args:
            metadata: Media metadata

        Returns:
            YouTube search query (just the title + "theme" or "soundtrack")
        """
        title = metadata['title']
        return f"{title} theme"

    def fetch_metadata(self, item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Extract metadata from CSV row (no external API needed).

        Args:
            item: Item from CSV with 'title', 'titleVF', 'youtube_url', 'category_id'

        Returns:
            Metadata dictionary
        """
        return {
            'title': item['title'],
            'titleVF': item.get('titleVF'),
            'youtube_url': item.get('youtube_url'),
            'category_id': self.override_category or item['category_id'],
            'poster_url': None,  # Will use YouTube thumbnail instead
        }

    def download_media(self, metadata: Dict[str, Any]) -> tuple[Optional[str], Optional[str]]:
        """
        Download audio and image for a media item.
        Uses YouTube thumbnail as image.

        Args:
            metadata: Metadata dictionary

        Returns:
            Tuple of (audio_path, image_path), either can be None on failure
        """
        title = metadata['title']
        slug = self.generate_slug(title)
        youtube_url = metadata.get('youtube_url')

        print(f"  Downloading audio and thumbnail from YouTube...")

        # If YouTube URL is provided, download from URL
        if youtube_url:
            audio_path, image_path = self._download_from_url_with_thumbnail(youtube_url, slug)
        else:
            # Otherwise, search YouTube
            search_query = self.build_search_query(metadata)
            audio_path, image_path = self.youtube_dl.download_audio_with_thumbnail(search_query, slug)

        return audio_path, image_path

    def _download_from_url_with_thumbnail(self, url: str, filename: str) -> tuple[Optional[str], Optional[str]]:
        """
        Download audio and thumbnail from a specific YouTube URL.

        Args:
            url: YouTube video URL
            filename: Output filename (without extension)

        Returns:
            Tuple of (audio_path, image_path)
        """
        from scripts.config import AUDIO_DIR
        import yt_dlp

        output_audio_path = AUDIO_DIR / f"{filename}.mp3"
        output_image_path = IMAGES_DIR / f"{filename}.jpg"

        # Check if both already exist
        if output_audio_path.exists() and output_image_path.exists():
            print(f"  -> Audio and thumbnail already exist: {filename}.mp3, {filename}.jpg")
            return f"/audio/{filename}.mp3", f"/images/{filename}.jpg"

        ydl_opts = {
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'outtmpl': str(AUDIO_DIR / filename),
            'quiet': True,
            'no_warnings': True,
            'writethumbnail': True,
            # Anti-bot measures
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'extractor_args': {'youtube': {'player_client': ['android', 'web']}},
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                print(f"  -> Downloading from URL: {url}")
                info = ydl.extract_info(url, download=True)

                # Download thumbnail manually
                if info.get('thumbnail'):
                    thumbnail_url = info['thumbnail']
                    # Get highest resolution thumbnail
                    if info.get('thumbnails'):
                        thumbnails = sorted(info['thumbnails'],
                                          key=lambda t: t.get('height', 0) or 0,
                                          reverse=True)
                        if thumbnails:
                            thumbnail_url = thumbnails[0]['url']

                    # Download thumbnail
                    try:
                        import requests
                        response = requests.get(thumbnail_url, timeout=30)
                        response.raise_for_status()
                        with open(output_image_path, 'wb') as f:
                            f.write(response.content)
                        print(f"  [OK] Thumbnail downloaded: {filename}.jpg")
                    except Exception as e:
                        print(f"  [WARN] Could not download thumbnail: {e}")

            # Verify files
            audio_path = None
            if output_audio_path.exists():
                print(f"  [OK] Audio downloaded: {filename}.mp3")
                # Normalize audio
                self.youtube_dl.normalize_audio_file(output_audio_path)
                audio_path = f"/audio/{filename}.mp3"

            image_path = None
            if output_image_path.exists():
                image_path = f"/images/{filename}.jpg"

            return audio_path, image_path

        except Exception as e:
            print(f"  [FAIL] Download error: {e}")
            return None, None

    def create_track(self, metadata: Dict[str, Any], audio_path: Optional[str], image_path: Optional[str]) -> bool:
        """
        Create track via API.
        Override to use the correct category_id from metadata.

        Args:
            metadata: Media metadata
            audio_path: Relative path to audio file
            image_path: Relative path to image file

        Returns:
            True if created successfully, False otherwise
        """
        if not audio_path:
            print(f"  [FAIL] Cannot create track without audio file")
            return False

        from scripts.utils.answers import generate_accepted_answers

        # Generate accepted answers
        title = metadata['title']
        title_vf = metadata.get('titleVF')
        accepted_answers = generate_accepted_answers(title, title_vf)

        # Get category from metadata
        category_id = metadata.get('category_id', self.category_id)

        # Build track data
        track_data = {
            'title': title,
            'acceptedAnswers': accepted_answers,
            'audioFile': audio_path,
            'categoryId': category_id,
            'timeLimit': 30,
            'startTime': 0,
        }

        # Add optional fields
        if title_vf:
            track_data['titleVF'] = title_vf
        if image_path:
            track_data['imageFile'] = image_path

        # Create via API
        print(f"  Creating track in database (category: {category_id})...")
        result = self.api_client.create_track(track_data)

        if result:
            print(f"  [OK] Track created with ID: {result.get('id')}")
            return True
        else:
            print(f"  [FAIL] Failed to create track")
            return False


def main():
    """Run CSV importer standalone."""
    import argparse
    import sys

    parser = argparse.ArgumentParser(
        description='Import media from CSV file',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
CSV Format (with header):
    title,titleVF,youtube_url,category_id
    The Shawshank Redemption,Les Évadés,https://youtube.com/watch?v=...,films
    Spirited Away,Le Voyage de Chihiro,,anime

Examples:
    # Import from CSV
    python scripts/importers/csv_importer.py data.csv

    # Specify API URL (e.g., production)
    python scripts/importers/csv_importer.py data.csv --api-url https://blindtest.nathangracia.com

    # Override category for all items
    python scripts/importers/csv_importer.py data.csv --category films
        """
    )

    parser.add_argument('csv_file', type=Path, help='Path to CSV file')
    parser.add_argument('--category', '-c', help='Override category ID for all items')
    parser.add_argument('--api-url', help='API base URL (default: http://localhost:3000)')
    parser.add_argument('--limit', '-l', type=int, help='Limit number of items to import')
    parser.add_argument('--no-skip-existing', action='store_true', help='Re-import existing tracks')

    args = parser.parse_args()

    if not args.csv_file.exists():
        print(f"Error: CSV file not found: {args.csv_file}")
        sys.exit(1)

    importer = CSVImporter(
        csv_file=args.csv_file,
        category_id=args.category,
        api_base_url=args.api_url
    )

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
        for error in stats['errors'][:5]:
            print(f"  - {error['id']}: {error['error']}")
        if len(stats['errors']) > 5:
            print(f"  ... and {len(stats['errors']) - 5} more")


if __name__ == '__main__':
    main()
