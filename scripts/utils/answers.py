"""
Generate accepted answer variations for track titles.
Handles multiple languages, transliterations, and common variations.
"""

import re
import unicodedata
from typing import List, Set, Optional


def normalize_title(title: str) -> str:
    """
    Normalize a title for comparison.

    Args:
        title: Input title

    Returns:
        Normalized lowercase title without accents
    """
    # Lowercase
    title = title.lower()

    # Remove accents
    title = unicodedata.normalize('NFD', title)
    title = ''.join(c for c in title if unicodedata.category(c) != 'Mn')

    # Normalize whitespace
    title = ' '.join(title.split())

    return title


def remove_articles(title: str) -> str:
    """
    Remove leading articles from title.

    Args:
        title: Input title

    Returns:
        Title without leading articles
    """
    # Articles in multiple languages
    articles = [
        'the', 'a', 'an',           # English
        'le', 'la', 'les', 'l',     # French
        'el', 'la', 'los', 'las',   # Spanish
        'der', 'die', 'das',        # German
        'il', 'lo', 'la', 'i',      # Italian
    ]

    title_lower = title.lower()
    for article in articles:
        pattern = rf'^{article}\s+'
        if re.match(pattern, title_lower):
            return title[len(article):].strip()

    return title


def remove_punctuation(title: str) -> str:
    """
    Remove punctuation from title.

    Args:
        title: Input title

    Returns:
        Title without punctuation
    """
    # Keep letters, numbers, and spaces
    return re.sub(r'[^\w\s]', '', title)


def extract_keywords(title: str, max_keywords: int = 3) -> List[str]:
    """
    Extract main keywords from title.

    Args:
        title: Input title
        max_keywords: Maximum number of keywords to extract

    Returns:
        List of keywords
    """
    # Remove articles and punctuation
    clean_title = remove_punctuation(remove_articles(title))

    # Split into words
    words = clean_title.lower().split()

    # Filter out common words
    stop_words = {
        'the', 'a', 'an', 'of', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'le', 'la', 'les', 'de', 'des', 'du', 'et', 'ou', 'dans', 'sur', 'avec',
        'part', 'volume', 'chapter', 'episode', 'season', 'series',
        'partie', 'tome', 'chapitre', 'saison',
    }

    keywords = [word for word in words if word not in stop_words and len(word) > 2]

    # Return top keywords (sorted by length, longer first)
    keywords.sort(key=len, reverse=True)
    return keywords[:max_keywords]


def generate_acronym(title: str) -> Optional[str]:
    """
    Generate acronym from title.

    Args:
        title: Input title

    Returns:
        Acronym or None if too short
    """
    # Remove punctuation and articles
    clean_title = remove_punctuation(remove_articles(title))
    words = clean_title.split()

    if len(words) < 2:
        return None

    # Take first letter of each word
    acronym = ''.join(word[0].upper() for word in words if len(word) > 0)

    # Only return if reasonable length
    if 2 <= len(acronym) <= 6:
        return acronym.lower()

    return None


def generate_accepted_answers(title: str, title_vf: Optional[str] = None) -> List[str]:
    """
    Generate all accepted answer variations for a title.

    Args:
        title: Original title (usually English)
        title_vf: French title (optional)

    Returns:
        List of accepted answer strings (unique, lowercased)

    Example:
        generate_accepted_answers(
            "The Lord of the Rings: The Return of the King",
            "Le Seigneur des Anneaux: Le Retour du Roi"
        )
        Returns: [
            "the lord of the rings the return of the king",
            "lord of the rings return of the king",
            "lord rings return king",
            "lotr",
            "le seigneur des anneaux le retour du roi",
            "seigneur anneaux retour roi",
            ...
        ]
    """
    answers: Set[str] = set()

    # Process original title
    normalized = normalize_title(title)
    answers.add(normalized)

    # Without articles
    without_articles = normalize_title(remove_articles(title))
    if without_articles != normalized:
        answers.add(without_articles)

    # Without punctuation
    without_punct = normalize_title(remove_punctuation(title))
    if without_punct != normalized:
        answers.add(without_punct)

    # Without articles and punctuation
    clean = normalize_title(remove_punctuation(remove_articles(title)))
    if clean != without_articles and clean != without_punct:
        answers.add(clean)

    # Keywords only
    keywords = extract_keywords(title)
    if keywords:
        keywords_str = ' '.join(keywords)
        answers.add(keywords_str)

    # Acronym
    acronym = generate_acronym(title)
    if acronym:
        answers.add(acronym)

    # Process French title if provided
    if title_vf:
        normalized_vf = normalize_title(title_vf)
        answers.add(normalized_vf)

        # Without articles (French)
        without_articles_vf = normalize_title(remove_articles(title_vf))
        if without_articles_vf != normalized_vf:
            answers.add(without_articles_vf)

        # Without punctuation (French)
        without_punct_vf = normalize_title(remove_punctuation(title_vf))
        if without_punct_vf != normalized_vf:
            answers.add(without_punct_vf)

        # Clean French
        clean_vf = normalize_title(remove_punctuation(remove_articles(title_vf)))
        if clean_vf != without_articles_vf and clean_vf != without_punct_vf:
            answers.add(clean_vf)

        # French keywords
        keywords_vf = extract_keywords(title_vf)
        if keywords_vf:
            keywords_vf_str = ' '.join(keywords_vf)
            answers.add(keywords_vf_str)

    # Remove empty strings and sort by length (shorter first for better UX)
    answers = {a.strip() for a in answers if a.strip()}
    return sorted(answers, key=len)
