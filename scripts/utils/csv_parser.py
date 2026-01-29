"""
CSV parser for media import.
"""
import csv
from pathlib import Path
from typing import List, Dict, Any


def parse_cartoon_csv(file_path: Path) -> List[Dict[str, Any]]:
    """
    Parse a CSV file containing cartoon titles.

    Args:
        file_path: Path to the CSV file

    Returns:
        List of dicts with 'index' and 'title' keys

    Example:
        [
            {"index": 1, "title": "Winx"},
            {"index": 2, "title": "Linus et Boom"},
            ...
        ]
    """
    cartoons = []

    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        for index, row in enumerate(reader, start=1):
            # Skip empty lines
            if not row or not row[0].strip():
                continue

            title = row[0].strip()
            cartoons.append({
                'index': index,
                'title': title
            })

    return cartoons


def parse_generic_csv(file_path: Path) -> List[Dict[str, Any]]:
    """
    Parse a generic CSV file for media import.

    Expected CSV format (with header):
        title,titleVF,youtube_url,category_id
        The Shawshank Redemption,Les Évadés,https://youtube.com/watch?v=...,films
        ,,,  (empty titleVF and youtube_url are allowed)

    Args:
        file_path: Path to the CSV file

    Returns:
        List of dicts with 'title', 'titleVF', 'youtube_url', 'category_id' keys

    Example:
        [
            {
                "title": "The Shawshank Redemption",
                "titleVF": "Les Évadés",
                "youtube_url": "https://youtube.com/watch?v=...",
                "category_id": "films"
            },
            ...
        ]
    """
    items = []

    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for index, row in enumerate(reader, start=1):
            # Skip empty lines
            if not row or not row.get('title', '').strip():
                continue

            title = row.get('title', '').strip()
            title_vf = row.get('titleVF', '').strip() or None
            youtube_url = row.get('youtube_url', '').strip() or None
            category_id = row.get('category_id', '').strip()

            if not category_id:
                print(f"Warning: Row {index} missing category_id, skipping")
                continue

            items.append({
                'title': title,
                'titleVF': title_vf,
                'youtube_url': youtube_url,
                'category_id': category_id,
                'index': index
            })

    return items
