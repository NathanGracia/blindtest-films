"""
Configuration management for media import scripts.
Handles environment variables, API keys, and paths.
"""

import os
import shutil
from pathlib import Path
from dotenv import load_dotenv

# Load .env files (.env.local takes priority over .env)
load_dotenv()  # Load .env
load_dotenv('.env.local', override=True)  # Load .env.local and override

# Project root directory
PROJECT_ROOT = Path(__file__).parent.parent.absolute()

# API Configuration
API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:3000')
API_TRACKS_ENDPOINT = f'{API_BASE_URL}/api/import/tracks'  # Use import endpoint for scripts
API_CATEGORIES_ENDPOINT = f'{API_BASE_URL}/api/categories'
API_TOKEN = os.getenv('IMPORT_API_TOKEN') or os.getenv('ADMIN_PASSWORD')

# OMDb API Configuration
OMDB_API_KEY = os.getenv('OMDB_API_KEY')
OMDB_API_URL = 'http://www.omdbapi.com/'

# File paths
AUDIO_DIR = Path(os.getenv('AUDIO_DIR', PROJECT_ROOT / 'public' / 'audio'))
IMAGES_DIR = Path(os.getenv('IMAGES_DIR', PROJECT_ROOT / 'public' / 'images'))

# FFmpeg detection (multi-platform)
def detect_ffmpeg():
    """Detect FFmpeg path automatically."""
    ffmpeg_path = os.getenv('FFMPEG_PATH')
    if ffmpeg_path and Path(ffmpeg_path).exists():
        return ffmpeg_path

    # Try to find ffmpeg in PATH
    ffmpeg = shutil.which('ffmpeg')
    if ffmpeg:
        return ffmpeg

    # Try common locations
    common_paths = [
        # Windows
        Path.home() / 'AppData' / 'Local' / 'Microsoft' / 'WinGet' / 'Packages',
        Path('C:/') / 'Program Files' / 'ffmpeg' / 'bin' / 'ffmpeg.exe',
        Path('C:/') / 'ffmpeg' / 'bin' / 'ffmpeg.exe',
        # macOS
        Path('/usr/local/bin/ffmpeg'),
        Path('/opt/homebrew/bin/ffmpeg'),
        # Linux
        Path('/usr/bin/ffmpeg'),
    ]

    for path in common_paths:
        if path.is_file():
            return str(path)
        # For WinGet packages, search for ffmpeg.exe
        if path.exists() and path.is_dir():
            for ffmpeg_exe in path.rglob('ffmpeg.exe'):
                return str(ffmpeg_exe)

    return None  # Let yt-dlp find it

FFMPEG_PATH = detect_ffmpeg()

# Default track settings
DEFAULT_TIME_LIMIT = 30
DEFAULT_START_TIME = 0

# Timeouts
HTTP_TIMEOUT = 30
YOUTUBE_DOWNLOAD_TIMEOUT = 120

# OMDb rate limiting (free tier: 1 req/sec)
OMDB_RATE_LIMIT_DELAY = 1.0

def ensure_directories():
    """Ensure required directories exist."""
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

def validate_config():
    """Validate configuration and warn about missing values."""
    warnings = []

    if not OMDB_API_KEY:
        warnings.append("OMDB_API_KEY not set. Get one from http://www.omdbapi.com/apikey.aspx")

    if not FFMPEG_PATH:
        warnings.append("FFmpeg not detected. Download from https://ffmpeg.org/download.html")

    return warnings

# Ensure directories exist on import
ensure_directories()
