"""
Wrapper minimal pour l'API OMDb (Open Movie Database).
Utilise uniquement pour recuperer l'affiche officielle d'un film par son titre
(meilleure qualite/fiabilite qu'une miniature YouTube).
"""

import requests
import time
from typing import Optional, Dict, Any

try:
    from scripts.config import OMDB_API_KEY, OMDB_API_URL, HTTP_TIMEOUT
except ImportError:
    from ..config import OMDB_API_KEY, OMDB_API_URL, HTTP_TIMEOUT

OMDB_RATE_LIMIT_DELAY = 1.0  # Free tier: 1 req/sec


class OMDbClient:
    """Client minimal pour recuperer une affiche de film via OMDb."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or OMDB_API_KEY
        self.cache: Dict[str, Optional[Dict[str, Any]]] = {}
        self.last_request_time = 0.0

    def _rate_limit(self):
        elapsed = time.time() - self.last_request_time
        if elapsed < OMDB_RATE_LIMIT_DELAY:
            time.sleep(OMDB_RATE_LIMIT_DELAY - elapsed)
        self.last_request_time = time.time()

    def fetch_by_title(self, title: str, year: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Recupere les metadonnees OMDb pour un titre.

        Returns:
            {"title", "year", "poster_url", "imdb_id"} ou None si introuvable.
        """
        if not self.api_key:
            return None

        cache_key = f"{title.lower()}|{year or ''}"
        if cache_key in self.cache:
            return self.cache[cache_key]

        self._rate_limit()
        params = {'t': title, 'apikey': self.api_key}
        if year:
            params['y'] = year

        try:
            response = requests.get(OMDB_API_URL, params=params, timeout=HTTP_TIMEOUT)
            response.raise_for_status()
            data = response.json()
        except requests.RequestException as e:
            print(f"  [WARN] OMDb request failed: {e}")
            return None

        if data.get('Response') == 'False':
            self.cache[cache_key] = None
            return None

        result = {
            'title': data.get('Title'),
            'year': data.get('Year'),
            'poster_url': data.get('Poster') if data.get('Poster') != 'N/A' else None,
            'imdb_id': data.get('imdbID'),
        }
        self.cache[cache_key] = result
        return result
