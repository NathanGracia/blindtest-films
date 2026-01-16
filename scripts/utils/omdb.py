"""
Wrapper for the OMDb API (Open Movie Database).
Fetches movie/series metadata and posters.
"""

import requests
import time
from typing import Optional, Dict, Any, List

try:
    from scripts.config import OMDB_API_KEY, OMDB_API_URL, OMDB_RATE_LIMIT_DELAY, HTTP_TIMEOUT
except ImportError:
    from ..config import OMDB_API_KEY, OMDB_API_URL, OMDB_RATE_LIMIT_DELAY, HTTP_TIMEOUT


class OMDbClient:
    """Client for interacting with the OMDb API."""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize OMDb client.

        Args:
            api_key: OMDb API key (default from config)
        """
        self.api_key = api_key or OMDB_API_KEY
        self.api_url = OMDB_API_URL
        self.cache = {}
        self.last_request_time = 0

    def _rate_limit(self):
        """Enforce rate limiting (1 request per second for free tier)."""
        elapsed = time.time() - self.last_request_time
        if elapsed < OMDB_RATE_LIMIT_DELAY:
            time.sleep(OMDB_RATE_LIMIT_DELAY - elapsed)
        self.last_request_time = time.time()

    def _request(self, params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Make request to OMDb API.

        Args:
            params: Query parameters

        Returns:
            Response data dictionary or None on error
        """
        if not self.api_key:
            raise ValueError("OMDb API key not configured. Set OMDB_API_KEY environment variable.")

        # Rate limiting
        self._rate_limit()

        # Add API key to params
        params['apikey'] = self.api_key

        try:
            response = requests.get(self.api_url, params=params, timeout=HTTP_TIMEOUT)
            response.raise_for_status()
            data = response.json()

            # Check for API error
            if data.get('Response') == 'False':
                error = data.get('Error', 'Unknown error')
                print(f"OMDb API error: {error}")
                return None

            return data
        except requests.RequestException as e:
            print(f"OMDb request failed: {e}")
            return None

    def fetch_by_imdb_id(self, imdb_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetch movie/series data by IMDb ID.

        Args:
            imdb_id: IMDb ID (e.g., "tt0111161")

        Returns:
            Standardized metadata dictionary or None on error
            {
                "title": str,
                "titleVF": None,  # Not provided by OMDb
                "year": str,
                "poster_url": str | None,
                "imdb_id": str,
                "type": "movie" | "series",
                "plot": str | None
            }
        """
        # Check cache
        if imdb_id in self.cache:
            return self.cache[imdb_id]

        params = {'i': imdb_id}
        data = self._request(params)

        if not data:
            return None

        # Normalize response
        result = {
            'title': data.get('Title'),
            'titleVF': None,  # Not provided by OMDb, must be added manually
            'year': data.get('Year'),
            'poster_url': data.get('Poster') if data.get('Poster') != 'N/A' else None,
            'imdb_id': data.get('imdbID'),
            'type': data.get('Type'),  # "movie" or "series"
            'plot': data.get('Plot') if data.get('Plot') != 'N/A' else None
        }

        # Cache result
        self.cache[imdb_id] = result

        return result

    def fetch_by_title(self, title: str, year: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """
        Fetch movie/series data by title.

        Args:
            title: Movie/series title
            year: Optional year to narrow search

        Returns:
            Standardized metadata dictionary or None on error
        """
        params = {'t': title}
        if year:
            params['y'] = str(year)

        data = self._request(params)

        if not data:
            return None

        # Normalize response (same as fetch_by_imdb_id)
        result = {
            'title': data.get('Title'),
            'titleVF': None,
            'year': data.get('Year'),
            'poster_url': data.get('Poster') if data.get('Poster') != 'N/A' else None,
            'imdb_id': data.get('imdbID'),
            'type': data.get('Type'),
            'plot': data.get('Plot') if data.get('Plot') != 'N/A' else None
        }

        # Cache by IMDb ID if available
        if result['imdb_id']:
            self.cache[result['imdb_id']] = result

        return result

    def search(self, query: str) -> List[Dict[str, Any]]:
        """
        Search for movies/series by title.

        Args:
            query: Search query

        Returns:
            List of search result dictionaries
        """
        params = {'s': query}
        data = self._request(params)

        if not data or 'Search' not in data:
            return []

        return [
            {
                'title': item.get('Title'),
                'year': item.get('Year'),
                'imdb_id': item.get('imdbID'),
                'type': item.get('Type'),
                'poster_url': item.get('Poster') if item.get('Poster') != 'N/A' else None
            }
            for item in data['Search']
        ]
