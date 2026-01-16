"""
Main orchestrator for running category imports.
Can run all categories or specific ones via CLI.
"""

import argparse
import sys
import os
from typing import List, Optional
from tqdm import tqdm

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.config import OMDB_API_KEY, API_BASE_URL, validate_config
from scripts.importers.films import FilmsImporter


# Map category names to importer classes
IMPORTERS = {
    'films': FilmsImporter,
    # Add more importers as they're implemented:
    # 'series': SeriesImporter,
    # 'jeux': JeuxImporter,
    # 'anime': AnimeImporter,
}


def print_stats(category: str, stats: dict):
    """
    Print import statistics.

    Args:
        category: Category name
        stats: Statistics dictionary
    """
    print("\n" + "=" * 60)
    print(f"Summary for {category.title()}")
    print("=" * 60)
    print(f"Total:       {stats['total']}")
    print(f"Successful:  {stats['successful']}")
    print(f"Failed:      {stats['failed']}")
    print(f"Skipped:     {stats['skipped']}")
    print(f"Duration:    {stats['duration']:.1f}s")

    if stats['errors']:
        print(f"\nErrors ({len(stats['errors'])}):")
        for error in stats['errors'][:5]:  # Show first 5 errors
            print(f"  - {error['id']}: {error['error']}")
        if len(stats['errors']) > 5:
            print(f"  ... and {len(stats['errors']) - 5} more")


def run_importer(
    category: str,
    api_key: Optional[str] = None,
    api_url: Optional[str] = None,
    skip_existing: bool = True,
    limit: Optional[int] = None,
    verbose: bool = False
) -> dict:
    """
    Run a single category importer.

    Args:
        category: Category name
        api_key: OMDb API key
        api_url: API base URL
        skip_existing: Skip existing tracks
        limit: Limit number of items
        verbose: Verbose output

    Returns:
        Statistics dictionary
    """
    importer_class = IMPORTERS.get(category)

    if not importer_class:
        print(f"Error: Unknown category '{category}'")
        print(f"Available categories: {', '.join(IMPORTERS.keys())}")
        sys.exit(1)

    # Instantiate importer
    importer = importer_class(omdb_api_key=api_key, api_base_url=api_url)

    # Run import
    stats = importer.import_all(skip_existing=skip_existing, max_items=limit)

    return stats


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description='Import media files for blindtest game',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Import all films
  python scripts/fixtures.py --categories films --api-key YOUR_KEY

  # Import first 3 films only
  python scripts/fixtures.py --categories films --limit 3

  # Import multiple categories
  python scripts/fixtures.py --categories films series

  # Force re-import existing tracks
  python scripts/fixtures.py --categories films --no-skip-existing
        """
    )

    parser.add_argument(
        '--api-key', '-k',
        help='OMDb API key (or set OMDB_API_KEY env var)'
    )
    parser.add_argument(
        '--categories', '-c',
        nargs='+',
        help=f'Categories to import (available: {", ".join(IMPORTERS.keys())})'
    )
    parser.add_argument(
        '--limit', '-l',
        type=int,
        help='Max items per category'
    )
    parser.add_argument(
        '--skip-existing',
        action='store_true',
        default=True,
        help='Skip tracks that already exist (default: True)'
    )
    parser.add_argument(
        '--no-skip-existing',
        action='store_true',
        help='Force re-import existing tracks'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview without importing (not implemented yet)'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Verbose output'
    )
    parser.add_argument(
        '--api-url',
        default=API_BASE_URL,
        help=f'Override API URL (default: {API_BASE_URL})'
    )

    args = parser.parse_args()

    # Validate configuration
    warnings = validate_config()
    if warnings:
        print("Configuration warnings:")
        for warning in warnings:
            print(f"  ⚠ {warning}")
        print()

    # Get API key
    api_key = args.api_key or OMDB_API_KEY
    if not api_key:
        print("Error: OMDb API key required.")
        print("  Use --api-key or set OMDB_API_KEY environment variable.")
        print("  Get a free key at: http://www.omdbapi.com/apikey.aspx")
        sys.exit(1)

    # Get categories to import
    categories = args.categories if args.categories else list(IMPORTERS.keys())

    # Validate categories
    invalid_categories = [c for c in categories if c not in IMPORTERS]
    if invalid_categories:
        print(f"Error: Unknown categories: {', '.join(invalid_categories)}")
        print(f"Available categories: {', '.join(IMPORTERS.keys())}")
        sys.exit(1)

    # Handle skip_existing
    skip_existing = not args.no_skip_existing

    # Dry run
    if args.dry_run:
        print("DRY RUN MODE - No files will be downloaded or created")
        print(f"Would import categories: {', '.join(categories)}")
        if args.limit:
            print(f"Limit: {args.limit} items per category")
        print(f"Skip existing: {skip_existing}")
        sys.exit(0)

    # Run imports
    print(f"Starting import for: {', '.join(categories)}")
    print()

    all_stats = {}

    for category in categories:
        print(f"\n{'=' * 60}")
        print(f"Category: {category.upper()}")
        print('=' * 60)

        try:
            stats = run_importer(
                category=category,
                api_key=api_key,
                api_url=args.api_url,
                skip_existing=skip_existing,
                limit=args.limit,
                verbose=args.verbose
            )

            all_stats[category] = stats
            print_stats(category, stats)

        except KeyboardInterrupt:
            print("\n\nImport interrupted by user")
            break
        except Exception as e:
            print(f"\n[FAIL] Error importing {category}: {e}")
            if args.verbose:
                import traceback
                traceback.print_exc()

    # Print overall summary
    if len(all_stats) > 1:
        print("\n" + "=" * 60)
        print("OVERALL SUMMARY")
        print("=" * 60)

        total_items = sum(s['total'] for s in all_stats.values())
        total_success = sum(s['successful'] for s in all_stats.values())
        total_failed = sum(s['failed'] for s in all_stats.values())
        total_skipped = sum(s['skipped'] for s in all_stats.values())
        total_duration = sum(s['duration'] for s in all_stats.values())

        print(f"Total items:     {total_items}")
        print(f"Successful:      {total_success}")
        print(f"Failed:          {total_failed}")
        print(f"Skipped:         {total_skipped}")
        print(f"Total duration:  {total_duration:.1f}s")

    print("\n[OK] Import completed!")


if __name__ == '__main__':
    main()
