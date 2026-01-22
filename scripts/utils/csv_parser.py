"""
CSV parser for cartoon titles.
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
