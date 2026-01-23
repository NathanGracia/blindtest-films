"""
Normalize audio levels of existing MP3 files.
Uses FFmpeg loudnorm filter for LUFS normalization.
"""

import os
import argparse
from pathlib import Path
from ffmpeg_normalize import FFmpegNormalize
from tqdm import tqdm
import shutil


class AudioNormalizer:
    """Batch audio normalizer for MP3 files."""

    def __init__(self, audio_dir, target_level=-16.0, backup=True):
        """
        Initialize audio normalizer.

        Args:
            audio_dir: Directory containing MP3 files
            target_level: Target LUFS level (default: -16.0)
            backup: Backup originals before normalization (default: True)
        """
        self.audio_dir = Path(audio_dir)
        self.backup_dir = self.audio_dir / '.originals'
        self.target_level = target_level
        self.backup = backup
        self.stats = {'processed': 0, 'failed': 0, 'skipped': 0}

    def find_mp3_files(self):
        """
        Scan for MP3 files, exclude backups.

        Returns:
            List of Path objects for MP3 files
        """
        mp3_files = []
        for file in self.audio_dir.glob('*.mp3'):
            # Skip hidden files and backups
            if not file.name.startswith('.'):
                mp3_files.append(file)
        return sorted(mp3_files)

    def backup_file(self, file_path):
        """
        Backup original file to .originals/ directory.

        Args:
            file_path: Path to file to backup

        Returns:
            True if backup was created, False if already exists
        """
        if self.backup:
            self.backup_dir.mkdir(exist_ok=True)
            backup_path = self.backup_dir / file_path.name

            # Only backup if doesn't already exist
            if not backup_path.exists():
                shutil.copy2(file_path, backup_path)
                return True
            else:
                # Backup exists, file already normalized
                return False
        return True  # No backup mode, proceed anyway

    def normalize_file(self, file_path, verbose=False):
        """
        Normalize a single MP3 file to target LUFS.

        Args:
            file_path: Path to MP3 file
            verbose: Print detailed output

        Returns:
            True if successful, False otherwise
        """
        try:
            # Check if already normalized (backup exists)
            if self.backup:
                backup_exists = (self.backup_dir / file_path.name).exists()
                if backup_exists:
                    self.stats['skipped'] += 1
                    return True  # Already normalized, skip

            # Backup original
            if self.backup:
                backup_created = self.backup_file(file_path)
                if not backup_created:
                    # This shouldn't happen due to the check above, but just in case
                    self.stats['skipped'] += 1
                    return True

            # Normalize to temporary file
            temp_output = file_path.with_suffix('.normalized.mp3')

            if verbose:
                print(f"  Normalizing: {file_path.name}")

            normalizer = FFmpegNormalize(
                normalization_type='ebu',       # EBU R128 (LUFS)
                target_level=self.target_level, # -16 LUFS
                audio_codec='libmp3lame',       # MP3 output
                audio_bitrate='192k',           # Same as original
                sample_rate=44100,              # Standard audio
                print_stats=verbose,            # Show stats
            )

            normalizer.add_media_file(str(file_path), str(temp_output))
            normalizer.run_normalization()

            # Replace original with normalized
            if temp_output.exists():
                temp_output.replace(file_path)
                self.stats['processed'] += 1
                return True
            else:
                print(f"  [WARN] Normalized file not created: {file_path.name}")
                self.stats['failed'] += 1
                return False

        except Exception as e:
            print(f"  [ERROR] {file_path.name}: {e}")
            self.stats['failed'] += 1
            return False

    def normalize_all(self, dry_run=False, verbose=False, limit=None):
        """
        Normalize all MP3 files in directory.

        Args:
            dry_run: Preview without modifying files
            verbose: Print detailed output
            limit: Maximum number of files to process (None = all)
        """
        files = self.find_mp3_files()
        print(f"Found {len(files)} MP3 files in {self.audio_dir}")

        if dry_run:
            print("\n[DRY RUN] No files will be modified\n")
            for file in files:
                print(f"  Would normalize: {file.name}")
            return

        # Filter out already normalized files (have backups)
        if self.backup:
            files_to_process = [f for f in files if not (self.backup_dir / f.name).exists()]
            skipped_count = len(files) - len(files_to_process)
            if skipped_count > 0:
                print(f"Skipping {skipped_count} already normalized files")
        else:
            files_to_process = files

        # Apply limit if specified
        if limit and limit > 0:
            files_to_process = files_to_process[:limit]
            print(f"Processing {len(files_to_process)} files (limit: {limit})")

        print(f"Target LUFS: {self.target_level}")
        print(f"Backup originals: {self.backup}")
        print("")

        # Process files with progress bar
        for file_path in tqdm(files_to_process, desc="Normalizing MP3s", unit="file"):
            self.normalize_file(file_path, verbose=verbose)

        # Print summary
        print("\n" + "=" * 60)
        print("NORMALIZATION SUMMARY")
        print("=" * 60)
        print(f"Processed:  {self.stats['processed']}")
        print(f"Failed:     {self.stats['failed']}")
        print(f"Skipped:    {self.stats['skipped']}")
        print(f"Total:      {len(files)}")
        print("=" * 60)

        if self.backup and self.stats['processed'] > 0:
            print(f"\nOriginals backed up to: {self.backup_dir}")


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description='Normalize MP3 audio levels using LUFS',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run (preview)
  python scripts/normalize_existing.py --dry-run

  # Normalize all files with backup
  python scripts/normalize_existing.py

  # Custom target level
  python scripts/normalize_existing.py --target-level -14

  # No backup
  python scripts/normalize_existing.py --no-backup

  # Verbose output
  python scripts/normalize_existing.py --verbose
        """
    )

    parser.add_argument(
        '--target-level',
        type=float,
        default=-16.0,
        help='Target LUFS level (default: -16.0, streaming standard)'
    )

    parser.add_argument(
        '--no-backup',
        action='store_true',
        help='Skip backup of original files (not recommended)'
    )

    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview files to be normalized without processing'
    )

    parser.add_argument(
        '--directory',
        default='public/audio',
        help='Audio directory (default: public/audio)'
    )

    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Print detailed normalization output'
    )

    parser.add_argument(
        '--limit',
        type=int,
        default=None,
        help='Maximum number of files to process (useful for batch processing)'
    )

    args = parser.parse_args()

    # Validate directory exists
    audio_dir = Path(args.directory)
    if not audio_dir.exists():
        print(f"Error: Directory not found: {audio_dir}")
        return 1

    # Create normalizer
    normalizer = AudioNormalizer(
        audio_dir=audio_dir,
        target_level=args.target_level,
        backup=not args.no_backup,
    )

    # Run normalization
    try:
        normalizer.normalize_all(dry_run=args.dry_run, verbose=args.verbose, limit=args.limit)
        return 0
    except KeyboardInterrupt:
        print("\n\nNormalization interrupted by user")
        return 130
    except Exception as e:
        print(f"\nError: {e}")
        return 1


if __name__ == '__main__':
    exit(main())
