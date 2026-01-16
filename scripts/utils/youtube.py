"""
YouTube audio downloader using yt-dlp.
Downloads theme songs and extracts audio to MP3.
"""

import yt_dlp
from pathlib import Path
from typing import Optional

try:
    from scripts.config import AUDIO_DIR, FFMPEG_PATH, YOUTUBE_DOWNLOAD_TIMEOUT
except ImportError:
    from ..config import AUDIO_DIR, FFMPEG_PATH, YOUTUBE_DOWNLOAD_TIMEOUT


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
        }

        # Add ffmpeg location if detected
        if self.ffmpeg_path:
            ydl_opts['ffmpeg_location'] = str(Path(self.ffmpeg_path).parent)

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                print(f"  -> Searching YouTube: {search_query}")
                ydl.download([search_query])

            # Verify file was created
            if output_path.exists():
                print(f"  [OK] Audio downloaded: {filename}.mp3")
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
