"""
Script to clean up film franchises in production database.
Removes duplicate films from franchises (Star Wars, LOTR, Godfather, Terminator).
"""

import os
import requests
import sys
from typing import List, Dict, Optional

# Configuration
API_BASE_URL = os.getenv('API_BASE_URL', 'https://blindtest.nathangracia.com')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'daciaduster')

# Films à supprimer (titres exacts en production)
FILMS_TO_DELETE = [
    "Star Wars : L'Empire contre-attaque",
    "Le Seigneur des anneaux : Le Retour du roi",
    "Le Seigneur des anneaux : Les Deux Tours",
    "Le Parrain, 2e partie",
    "Terminator",  # Le premier, pas T2
]

# Films à renommer (ancien titre → nouveau titre)
FILMS_TO_RENAME = {
    "Star Wars : Un nouvel espoir": "Star Wars",
    "Le Seigneur des anneaux : La Communauté de l'anneau": "Le Seigneur des anneaux",
    "Terminator 2 : Le Jugement dernier": "Terminator",
}


def get_all_tracks(api_url: str) -> List[Dict]:
    """Récupère toutes les tracks depuis l'API."""
    url = f"{api_url}/api/tracks"
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"❌ Erreur récupération des tracks: {e}")
        sys.exit(1)


def delete_track(api_url: str, track_id: int, password: str) -> bool:
    """Supprime une track via l'API."""
    url = f"{api_url}/api/import/tracks/{track_id}"
    headers = {
        'Authorization': f'Bearer {password}',
        'Content-Type': 'application/json'
    }

    try:
        response = requests.delete(url, headers=headers, timeout=30)
        response.raise_for_status()
        return True
    except Exception as e:
        print(f"   ❌ Erreur suppression: {e}")
        return False


def update_track(api_url: str, track_id: int, new_data: Dict, password: str) -> bool:
    """Met à jour une track via l'API."""
    url = f"{api_url}/api/import/tracks/{track_id}"
    headers = {
        'Authorization': f'Bearer {password}',
        'Content-Type': 'application/json'
    }

    try:
        response = requests.put(url, headers=headers, json=new_data, timeout=30)
        if response.status_code == 405:
            # PUT non supporté, essayer PATCH
            response = requests.patch(url, headers=headers, json=new_data, timeout=30)

        response.raise_for_status()
        return True
    except Exception as e:
        print(f"   ⚠️ Mise à jour non supportée: {e}")
        print(f"   💡 Veuillez renommer manuellement via l'interface admin")
        return False


def main():
    """Nettoie les films en production."""
    print("=" * 70)
    print("🧹 Nettoyage des franchises de films en production")
    print("=" * 70)
    print(f"\nAPI: {API_BASE_URL}")
    print()

    # Récupérer toutes les tracks
    print("📥 Récupération des tracks...")
    all_tracks = get_all_tracks(API_BASE_URL)
    films = [t for t in all_tracks if t.get('categoryId') == 'films']
    print(f"   ✅ {len(films)} films trouvés")
    print()

    # Supprimer les films en double
    print("🗑️  Suppression des films en double...")
    deleted_count = 0
    for title in FILMS_TO_DELETE:
        track = next((t for t in films if t['title'] == title), None)
        if track:
            print(f"   Suppression: {title} (ID: {track['id']})")
            if delete_track(API_BASE_URL, track['id'], ADMIN_PASSWORD):
                print(f"   ✅ Supprimé")
                deleted_count += 1
            else:
                print(f"   ❌ Échec")
        else:
            print(f"   ⚠️  Non trouvé: {title}")

    print(f"\n   Total supprimé: {deleted_count}/{len(FILMS_TO_DELETE)}")
    print()

    # Renommer les films
    print("✏️  Renommage des films...")
    renamed_count = 0
    for old_title, new_title in FILMS_TO_RENAME.items():
        track = next((t for t in films if t['title'] == old_title), None)
        if track:
            print(f"   Renommage: \"{old_title}\" → \"{new_title}\"")
            new_data = {**track, 'title': new_title}
            if update_track(API_BASE_URL, track['id'], new_data, ADMIN_PASSWORD):
                print(f"   ✅ Renommé")
                renamed_count += 1
        else:
            print(f"   ⚠️  Non trouvé: {old_title}")

    print(f"\n   Total renommé: {renamed_count}/{len(FILMS_TO_RENAME)}")
    print()

    # Résumé
    print("=" * 70)
    print("📊 Résumé")
    print("=" * 70)
    print(f"Films supprimés: {deleted_count}")
    print(f"Films renommés: {renamed_count}")
    print()

    if renamed_count < len(FILMS_TO_RENAME):
        print("⚠️  Renommages manuels nécessaires:")
        print(f"   👉 Connectez-vous à {API_BASE_URL}/admin/tracks")
        print(f"   👉 Mot de passe: {ADMIN_PASSWORD}")
        print()
        for old_title, new_title in FILMS_TO_RENAME.items():
            print(f"   • \"{old_title}\" → \"{new_title}\"")

    print("\n✅ Nettoyage terminé!")


if __name__ == '__main__':
    main()
