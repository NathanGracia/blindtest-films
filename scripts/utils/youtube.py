"""
YouTube audio downloader using yt-dlp.
Downloads theme songs and extracts audio to MP3.
"""

import re
import yt_dlp
from pathlib import Path
from typing import Optional


def sanitize_search_query(query: str) -> str:
    """
    Sanitize search query to avoid URL scheme interpretation issues.

    Args:
        query: Raw search query

    Returns:
        Sanitized search query safe for yt-dlp
    """
    # Remove or replace characters that could be interpreted as URL schemes
    # e.g., "Mission: Impossible" -> "Mission Impossible"
    sanitized = re.sub(r':\s*', ' ', query)  # Replace ":" followed by optional space
    sanitized = re.sub(r'\s+', ' ', sanitized)  # Collapse multiple spaces
    return sanitized.strip()

try:
    from scripts.config import AUDIO_DIR, IMAGES_DIR, FFMPEG_PATH, YOUTUBE_DOWNLOAD_TIMEOUT
except ImportError:
    from ..config import AUDIO_DIR, IMAGES_DIR, FFMPEG_PATH, YOUTUBE_DOWNLOAD_TIMEOUT


class YouTubeDownloader:
    """YouTube audio downloader using yt-dlp."""

    def __init__(self, output_dir: Optional[Path] = None, ffmpeg_path: Optional[str] = None):
        """
        Initialize YouTube downloader.

        Args:
            output_dir: Output directory for audio files (default from config)
            ffmpeg_path: Path to ffmpeg executable (default from config)
        """
        self.output_dir = output_dir or AUDIO_DIR
        self.ffmpeg_path = ffmpeg_path or FFMPEG_PATH
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def normalize_audio_file(self, file_path: Path) -> bool:
        """
        Normalize audio file to -16 LUFS.

        Args:
            file_path: Path to MP3 file

        Returns:
            True if normalized successfully, False otherwise
        """
        try:
            from ffmpeg_normalize import FFmpegNormalize

            temp_output = file_path.with_suffix('.normalized.mp3')

            normalizer = FFmpegNormalize(
                normalization_type='ebu',       # EBU R128 (LUFS)
                target_level=-16.0,             # -16 LUFS (streaming standard)
                audio_codec='libmp3lame',       # MP3 output
                audio_bitrate='192k',           # Same bitrate
                sample_rate=44100,              # Standard audio
            )

            normalizer.add_media_file(str(file_path), str(temp_output))
            normalizer.run_normalization()

            # Replace original with normalized
            if temp_output.exists():
                temp_output.replace(file_path)
                print(f"  [OK] Audio normalized to -16 LUFS")
                return True
            else:
                print(f"  [WARN] Normalization failed: output file not created")
                return False

        except ImportError:
            print(f"  [WARN] ffmpeg-normalize not installed, skipping normalization")
            return False
        except Exception as e:
            print(f"  [WARN] Normalization failed: {e}")
            return False

    def download_audio(self, search_query: str, filename: str) -> Optional[str]:
        """
        Search YouTube and download audio as MP3.

        Args:
            search_query: YouTube search query
            filename: Output filename (without extension)

        Returns:
            Relative path to downloaded file (e.g., "/audio/filename.mp3")
            or None on failure
        """
        output_path = self.output_dir / f"{filename}.mp3"

        # Skip if already exists
        if output_path.exists():
            print(f"  -> Audio already exists: {filename}.mp3")
            return f"/audio/{filename}.mp3"

        ydl_opts = {
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'outtmpl': str(self.output_dir / filename),
            'quiet': True,
            'no_warnings': True,
            'default_search': 'ytsearch1',  # Search YouTube, first result
            'socket_timeout': YOUTUBE_DOWNLOAD_TIMEOUT,
            # Anti-bot measures
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'extractor_args': {'youtube': {'player_client': ['android', 'web']}},
        }

        # Add ffmpeg location if detected
        if self.ffmpeg_path:
            ydl_opts['ffmpeg_location'] = str(Path(self.ffmpeg_path).parent)

        try:
            # Sanitize search query to avoid URL scheme issues (e.g., "Mission: Impossible")
            safe_query = sanitize_search_query(search_query)
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                print(f"  -> Searching YouTube: {safe_query}")
                ydl.download([safe_query])

            # Verify file was created
            if output_path.exists():
                print(f"  [OK] Audio downloaded: {filename}.mp3")

                # Normalize audio to -16 LUFS
                self.normalize_audio_file(output_path)

                return f"/audio/{filename}.mp3"
            else:
                print(f"  [FAIL] Audio file not created: {filename}.mp3")
                return None

        except yt_dlp.utils.DownloadError as e:
            print(f"  [FAIL] Download error: {e}")
            return None
        except Exception as e:
            print(f"  [FAIL] Unexpected error: {e}")
            return None

    def download_from_url(self, url: str, filename: str) -> Optional[str]:
        """
        Download audio from a specific YouTube URL.

        Args:
            url: YouTube video URL
            filename: Output filename (without extension)

        Returns:
            Relative path to downloaded file or None on failure
        """
        output_path = self.output_dir / f"{filename}.mp3"

        # Skip if already exists
        if output_path.exists():
            print(f"  -> Audio already exists: {filename}.mp3")
            return f"/audio/{filename}.mp3"

        ydl_opts = {
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'outtmpl': str(self.output_dir / filename),
            'quiet': True,
            'no_warnings': True,
            'socket_timeout': YOUTUBE_DOWNLOAD_TIMEOUT,
            # Anti-bot measures
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'extractor_args': {'youtube': {'player_client': ['android', 'web']}},
        }

        # Add ffmpeg location if detected
        if self.ffmpeg_path:
            ydl_opts['ffmpeg_location'] = str(Path(self.ffmpeg_path).parent)

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                print(f"  -> Downloading from URL: {url}")
                ydl.download([url])

            # Verify file was created
            if output_path.exists():
                print(f"  [OK] Audio downloaded: {filename}.mp3")

                # Normalize audio to -16 LUFS
                self.normalize_audio_file(output_path)

                return f"/audio/{filename}.mp3"
            else:
                print(f"  [FAIL] Audio file not created: {filename}.mp3")
                return None

        except yt_dlp.utils.DownloadError as e:
            print(f"  [FAIL] Download error: {e}")
            return None
        except Exception as e:
            print(f"  [FAIL] Unexpected error: {e}")
            return None

    def download_audio_with_thumbnail(self, search_query: str, filename: str) -> tuple[Optional[str], Optional[str]]:
        """
        Search YouTube and download both audio and thumbnail.

        Args:
            search_query: YouTube search query
            filename: Output filename (without extension)

        Returns:
            Tuple of (audio_path, image_path), either can be None on failure
            - audio_path: e.g., "/audio/filename.mp3"
            - image_path: e.g., "/images/filename.jpg"
        """
        output_audio_path = self.output_dir / f"{filename}.mp3"
        output_image_path = IMAGES_DIR / f"{filename}.jpg"

        # Check if both already exist
        if output_audio_path.exists() and output_image_path.exists():
            print(f"  -> Audio and thumbnail already exist: {filename}.mp3, {filename}.jpg")
            return f"/audio/{filename}.mp3", f"/images/{filename}.jpg"

        # Check if only audio exists
        if output_audio_path.exists() and not output_image_path.exists():
            print(f"  -> Audio already exists: {filename}.mp3")
            audio_path = f"/audio/{filename}.mp3"
        else:
            audio_path = None

        ydl_opts = {
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'outtmpl': str(self.output_dir / filename),
            'quiet': True,
            'no_warnings': True,
            'default_search': 'ytsearch1',  # Search YouTube, first result
            'socket_timeout': YOUTUBE_DOWNLOAD_TIMEOUT,
            'writethumbnail': True,  # Download thumbnail
            # Anti-bot measures
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'extractor_args': {'youtube': {'player_client': ['android', 'web']}},
        }

        # Add ffmpeg location if detected
        if self.ffmpeg_path:
            ydl_opts['ffmpeg_location'] = str(Path(self.ffmpeg_path).parent)

        try:
            # Sanitize search query to avoid URL scheme issues
            safe_query = sanitize_search_query(search_query)
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                print(f"  -> Searching YouTube: {safe_query}")
                info = ydl.extract_info(safe_query, download=True)

                # Get the actual video info (first result from search)
                if 'entries' in info:
                    video_info = info['entries'][0]
                else:
                    video_info = info

                # Download thumbnail manually if not already done
                if video_info.get('thumbnail'):
                    thumbnail_url = video_info['thumbnail']
                    # Try to download the best quality thumbnail
                    if video_info.get('thumbnails'):
                        # Get highest resolution thumbnail
                        thumbnails = sorted(video_info['thumbnails'],
                                          key=lambda t: t.get('height', 0) or 0,
                                          reverse=True)
                        if thumbnails:
                            thumbnail_url = thumbnails[0]['url']

                    # Download thumbnail using requests
                    try:
                        import requests
                        response = requests.get(thumbnail_url, timeout=30)
                        response.raise_for_status()
                        with open(output_image_path, 'wb') as f:
                            f.write(response.content)
                        print(f"  [OK] Thumbnail downloaded: {filename}.jpg")
                    except Exception as e:
                        print(f"  [WARN] Could not download thumbnail: {e}")

            # Verify audio file was created (if not already existing)
            if not audio_path:
                if output_audio_path.exists():
                    print(f"  [OK] Audio downloaded: {filename}.mp3")

                    # Normalize audio to -16 LUFS
                    self.normalize_audio_file(output_audio_path)

                    audio_path = f"/audio/{filename}.mp3"
                else:
                    print(f"  [FAIL] Audio file not created: {filename}.mp3")

            # Verify image file
            image_path = None
            if output_image_path.exists():
                image_path = f"/images/{filename}.jpg"

            return audio_path, image_path

        except yt_dlp.utils.DownloadError as e:
            print(f"  [FAIL] Download error: {e}")
            return None, None
        except Exception as e:
            print(f"  [FAIL] Unexpected error: {e}")
            return None, None

    def get_video_info(self, url: str) -> Optional[dict]:
        """
        Get video information without downloading.

        Args:
            url: YouTube video URL

        Returns:
            Video info dictionary or None on error
        """
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                return ydl.extract_info(url, download=False)
        except Exception as e:
            print(f"Error getting video info: {e}")
            return None
