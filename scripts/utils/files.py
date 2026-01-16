"""
File management utilities for downloads and media storage.
"""

import requests
from pathlib import Path
from typing import Optional
from slugify import slugify

try:
    from scripts.config import AUDIO_DIR, IMAGES_DIR, HTTP_TIMEOUT
except ImportError:
    from ..config import AUDIO_DIR, IMAGES_DIR, HTTP_TIMEOUT


def ensure_directories_exist(audio_dir: Optional[Path] = None, images_dir: Optional[Path] = None):
    """
    Ensure required directories exist.

    Args:
        audio_dir: Audio directory path (default from config)
        images_dir: Images directory path (default from config)
    """
    audio = audio_dir or AUDIO_DIR
    images = images_dir or IMAGES_DIR

    audio.mkdir(parents=True, exist_ok=True)
    images.mkdir(parents=True, exist_ok=True)


def download_image(url: str, output_path: Path) -> Optional[str]:
    """
    Download image from URL.

    Args:
        url: Image URL
        output_path: Output file path

    Returns:
        Relative path to downloaded file (e.g., "/images/filename.jpg")
        or None on failure
    """
    if output_path.exists():
        print(f"  -> Image already exists: {output_path.name}")
        return f"/images/{output_path.name}"

    try:
        response = requests.get(url, timeout=HTTP_TIMEOUT, stream=True)
        response.raise_for_status()

        # Write to temporary file first
        temp_path = output_path.with_suffix('.tmp')
        with open(temp_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        # Atomic rename
        temp_path.rename(output_path)

        print(f"  [OK] Image downloaded: {output_path.name}")
        return f"/images/{output_path.name}"

    except requests.RequestException as e:
        print(f"  [FAIL] Image download failed: {e}")
        # Clean up temp file if exists
        if temp_path.exists():
            temp_path.unlink()
        return None
    except Exception as e:
        print(f"  [FAIL] Unexpected error downloading image: {e}")
        return None


def get_file_extension(url: str) -> str:
    """
    Get file extension from URL.

    Args:
        url: File URL

    Returns:
        File extension with dot (e.g., ".jpg")
    """
    path = Path(url.split('?')[0])  # Remove query params
    return path.suffix or '.jpg'  # Default to .jpg


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename by removing invalid characters.

    Args:
        filename: Original filename

    Returns:
        Safe filename
    """
    # Use slugify to create safe filename
    return slugify(filename, separator='-', lowercase=True)


def file_exists(path: Path) -> bool:
    """
    Check if file exists.

    Args:
        path: File path

    Returns:
        True if file exists, False otherwise
    """
    return path.exists() and path.is_file()


def get_file_size(path: Path) -> int:
    """
    Get file size in bytes.

    Args:
        path: File path

    Returns:
        File size in bytes, or 0 if file doesn't exist
    """
    if file_exists(path):
        return path.stat().st_size
    return 0


# Ensure directories exist on import
ensure_directories_exist()
