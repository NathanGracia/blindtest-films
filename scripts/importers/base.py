"""
Abstract base class for category-specific importers.
Provides common functionality and enforces interface.
"""

import time
import traceback
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, List, Optional, Any
from slugify import slugify

try:
    from scripts.config import DEFAULT_TIME_LIMIT, DEFAULT_START_TIME, IMAGES_DIR
    from scripts.utils.api_client import TrackAPIClient
    from scripts.utils.omdb import OMDbClient
    from scripts.utils.youtube import YouTubeDownloader
    from scripts.utils.answers import generate_accepted_answers
    from scripts.utils.files import download_image
except ImportError:
    from ..config import DEFAULT_TIME_LIMIT, DEFAULT_START_TIME, IMAGES_DIR
    from ..utils.api_client import TrackAPIClient
    from ..utils.omdb import OMDbClient
    from ..utils.youtube import YouTubeDownloader
    from ..utils.answers import generate_accepted_answers
    from ..utils.files import download_image


class BaseImporter(ABC):
    """Base class for category-specific importers."""

    def __init__(self, category_id: str, omdb_api_key: Optional[str] = None, api_base_url: Optional[str] = None):
        """
        Initialize importer.

        Args:
            category_id: Category ID (e.g., "films", "series")
            omdb_api_key: OMDb API key (optional)
            api_base_url: API base URL (optional)
        """
        self.category_id = category_id
        self.api_client = TrackAPIClient(api_base_url)
        self.omdb_client = OMDbClient(omdb_api_key) if omdb_api_key else None
        self.youtube_dl = YouTubeDownloader()

    @abstractmethod
    def get_media_list(self) -> List[Dict[str, Any]]:
        """
        Get list of media items to import.

        Returns:
            List of item dictionaries (format depends on category)
        """
        pass

    @abstractmethod
    def build_search_query(self, metadata: Dict[str, Any]) -> str:
        """
        Build YouTube search query for a media item.

        Args:
            metadata: Media metadata dictionary

        Returns:
            YouTube search query string
        """
        pass

    @abstractmethod
    def fetch_metadata(self, item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Fetch metadata for a media item.

        Args:
            item: Item from get_media_list()

        Returns:
            Metadata dictionary with at least:
            - title (str): Original title
            - titleVF (str | None): French title
            - year (str): Release year
            - poster_url (str | None): Poster image URL
        """
        pass

    def generate_slug(self, title: str) -> str:
        """
        Generate slug from title for filenames.

        Args:
            title: Media title

        Returns:
            Slugified string safe for filenames
        """
        return slugify(title, separator='-', lowercase=True)

    def download_media(self, metadata: Dict[str, Any]) -> tuple[Optional[str], Optional[str]]:
        """
        Download audio and image for a media item.

        Args:
            metadata: Metadata dictionary

        Returns:
            Tuple of (audio_path, image_path), either can be None on failure
        """
        title = metadata['title']
        slug = self.generate_slug(title)

        # Download audio
        print(f"  Downloading audio...")
        search_query = self.build_search_query(metadata)
        audio_path = self.youtube_dl.download_audio(search_query, slug)

        # Download image
        print(f"  Downloading image...")
        image_path = None
        if metadata.get('poster_url'):
            image_filename = f"{slug}.jpg"
            image_output = IMAGES_DIR / image_filename
            image_path = download_image(metadata['poster_url'], image_output)

        return audio_path, image_path

    def create_track(self, metadata: Dict[str, Any], audio_path: Optional[str], image_path: Optional[str]) -> bool:
        """
        Create track via API.

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

        # Generate accepted answers
        title = metadata['title']
        title_vf = metadata.get('titleVF')
        accepted_answers = generate_accepted_answers(title, title_vf)

        # Build track data
        track_data = {
            'title': title,
            'acceptedAnswers': accepted_answers,
            'audioFile': audio_path,
            'categoryId': self.category_id,
            'timeLimit': DEFAULT_TIME_LIMIT,
            'startTime': DEFAULT_START_TIME,
        }

        # Add optional fields
        if title_vf:
            track_data['titleVF'] = title_vf
        if image_path:
            track_data['imageFile'] = image_path

        # Create via API
        print(f"  Creating track in database...")
        result = self.api_client.create_track(track_data)

        if result:
            print(f"  [OK] Track created with ID: {result.get('id')}")
            return True
        else:
            print(f"  [FAIL] Failed to create track")
            return False

    def import_single(self, item: Dict[str, Any], skip_existing: bool = True) -> Dict[str, Any]:
        """
        Import a single media item.

        Args:
            item: Item dictionary from get_media_list()
            skip_existing: Skip if track already exists

        Returns:
            Status dictionary with 'status' and optional 'error' keys
        """
        try:
            # Fetch metadata
            print(f"  Fetching metadata...")
            metadata = self.fetch_metadata(item)

            if not metadata:
                return {'status': 'failed', 'error': 'Failed to fetch metadata'}

            title = metadata['title']
            print(f"  Title: {title}")

            # Check if exists
            if skip_existing and self.api_client.track_exists(title):
                print(f"  -> Already exists, skipped")
                return {'status': 'skipped', 'reason': 'already exists'}

            # Download media
            audio_path, image_path = self.download_media(metadata)

            # Create track
            success = self.create_track(metadata, audio_path, image_path)

            if success:
                return {'status': 'success'}
            else:
                return {'status': 'failed', 'error': 'Failed to create track'}

        except Exception as e:
            error_msg = str(e)
            tb = traceback.format_exc()
            print(f"  [FAIL] Error: {error_msg}")
            return {'status': 'failed', 'error': error_msg, 'traceback': tb}

    def import_all(self, skip_existing: bool = True, max_items: Optional[int] = None) -> Dict[str, Any]:
        """
        Import all media items.

        Args:
            skip_existing: Skip tracks that already exist
            max_items: Maximum number of items to import (None for all)

        Returns:
            Statistics dictionary with counts and errors
        """
        media_list = self.get_media_list()

        if max_items:
            media_list = media_list[:max_items]

        stats = {
            'total': len(media_list),
            'successful': 0,
            'failed': 0,
            'skipped': 0,
            'errors': [],
            'duration': 0,
        }

        start_time = time.time()

        print(f"\nImporting {self.category_id.title()} ({len(media_list)} items)")
        print("=" * 60)

        for i, item in enumerate(media_list, 1):
            item_id = item.get('id', item.get('title', f'item_{i}'))
            print(f"\n[{i}/{len(media_list)}] {item_id}")

            result = self.import_single(item, skip_existing)

            if result['status'] == 'success':
                stats['successful'] += 1
            elif result['status'] == 'skipped':
                stats['skipped'] += 1
            else:
                stats['failed'] += 1
                stats['errors'].append({
                    'id': item_id,
                    'error': result.get('error', 'Unknown error'),
                    'traceback': result.get('traceback', '')
                })

        stats['duration'] = time.time() - start_time

        return stats
