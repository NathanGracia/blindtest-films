"""
API client for communicating with the blindtest backend.
Handles all HTTP requests to the Next.js API.
"""

import requests
import time
from typing import Optional, List, Dict, Any

try:
    from scripts.config import API_TRACKS_ENDPOINT, API_CATEGORIES_ENDPOINT, HTTP_TIMEOUT, API_TOKEN
except ImportError:
    from ..config import API_TRACKS_ENDPOINT, API_CATEGORIES_ENDPOINT, HTTP_TIMEOUT, API_TOKEN


class TrackAPIClient:
    """Client for interacting with the track API."""

    def __init__(self, base_url: Optional[str] = None, timeout: int = HTTP_TIMEOUT, api_token: Optional[str] = None):
        """
        Initialize API client.

        Args:
            base_url: Base URL for API (default from config)
            timeout: Request timeout in seconds
            api_token: API token for authentication (default from config)
        """
        self.base_url = base_url or API_TRACKS_ENDPOINT.rsplit('/api/import/tracks', 1)[0]
        self.tracks_endpoint = f'{self.base_url}/api/import/tracks'
        self.categories_endpoint = f'{self.base_url}/api/categories'
        self.timeout = timeout
        self.api_token = api_token or API_TOKEN
        self.session = requests.Session()

        # Add authorization header if token is provided
        if self.api_token:
            self.session.headers.update({'Authorization': f'Bearer {self.api_token}'})

    def _request(self, method: str, url: str, **kwargs) -> requests.Response:
        """
        Make HTTP request with retry logic.

        Args:
            method: HTTP method (GET, POST, etc.)
            url: Request URL
            **kwargs: Additional request parameters

        Returns:
            Response object

        Raises:
            requests.RequestException: On request failure after retries
        """
        max_retries = 3
        retry_delay = 1

        for attempt in range(max_retries):
            try:
                response = self.session.request(
                    method=method,
                    url=url,
                    timeout=self.timeout,
                    **kwargs
                )
                response.raise_for_status()
                return response
            except requests.exceptions.RequestException as e:
                if attempt == max_retries - 1:
                    raise
                print(f"Request failed (attempt {attempt + 1}/{max_retries}): {e}")
                time.sleep(retry_delay * (attempt + 1))

    def get_tracks(self) -> List[Dict[str, Any]]:
        """
        Get all tracks from the API.

        Returns:
            List of track dictionaries
        """
        try:
            response = self._request('GET', self.tracks_endpoint)
            return response.json()
        except Exception as e:
            print(f"Error fetching tracks: {e}")
            return []

    def get_track(self, track_id: int) -> Optional[Dict[str, Any]]:
        """
        Get a single track by ID.

        Args:
            track_id: Track ID

        Returns:
            Track dictionary or None if not found
        """
        try:
            url = f'{self.tracks_endpoint}/{track_id}'
            response = self._request('GET', url)
            return response.json()
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                return None
            raise
        except Exception as e:
            print(f"Error fetching track {track_id}: {e}")
            return None

    def create_track(self, track_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Create a new track.

        Args:
            track_data: Track data dictionary with required fields:
                - title (str): Track title
                - acceptedAnswers (list): List of accepted answer strings
                - audioFile (str): Path to audio file
                - categoryId (str): Category ID
                Optional fields:
                - titleVF (str): French title
                - imageFile (str): Path to image file
                - timeLimit (int): Time limit in seconds
                - startTime (int): Start time in seconds

        Returns:
            Created track dictionary with ID, or None on failure
        """
        try:
            response = self._request(
                'POST',
                self.tracks_endpoint,
                json=track_data,
                headers={'Content-Type': 'application/json'}
            )
            return response.json()
        except requests.exceptions.HTTPError as e:
            print(f"HTTP error creating track: {e}")
            if e.response:
                try:
                    error_data = e.response.json()
                    print(f"Error details: {error_data}")
                except:
                    print(f"Response text: {e.response.text}")
            return None
        except Exception as e:
            print(f"Error creating track: {e}")
            return None

    def update_track(self, track_id: int, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Update an existing track.

        Args:
            track_id: Track ID
            updates: Dictionary of fields to update

        Returns:
            Updated track dictionary or None on failure
        """
        try:
            url = f'{self.tracks_endpoint}/{track_id}'
            response = self._request(
                'PUT',
                url,
                json=updates,
                headers={'Content-Type': 'application/json'}
            )
            return response.json()
        except Exception as e:
            print(f"Error updating track {track_id}: {e}")
            return None

    def delete_track(self, track_id: int) -> bool:
        """
        Delete a track.

        Args:
            track_id: Track ID

        Returns:
            True if deleted successfully, False otherwise
        """
        try:
            url = f'{self.tracks_endpoint}/{track_id}'
            self._request('DELETE', url)
            return True
        except Exception as e:
            print(f"Error deleting track {track_id}: {e}")
            return False

    def track_exists(self, title: str) -> bool:
        """
        Check if a track with the given title exists.

        Args:
            title: Track title to check (case-insensitive)

        Returns:
            True if track exists, False otherwise
        """
        tracks = self.get_tracks()
        normalized_title = title.lower().strip()
        return any(
            track.get('title', '').lower().strip() == normalized_title
            for track in tracks
        )

    def get_categories(self) -> List[Dict[str, Any]]:
        """
        Get all categories.

        Returns:
            List of category dictionaries
        """
        try:
            response = self._request('GET', self.categories_endpoint)
            return response.json()
        except Exception as e:
            print(f"Error fetching categories: {e}")
            return []

    def validate_connection(self) -> bool:
        """
        Validate API connection.

        Returns:
            True if API is accessible, False otherwise
        """
        try:
            self.get_categories()
            return True
        except Exception as e:
            print(f"API connection failed: {e}")
            return False
