# Normalisation des fichiers audio

Guide complet pour normaliser tous les fichiers audio existants à **-16 LUFS** (standard streaming).

---

## 📋 Prérequis

### 1. Installer ffmpeg (système)

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install ffmpeg

# Vérifier l'installation
ffmpeg -version
```

### 2. Créer un environnement virtuel Python

```bash
cd ~/blindtest-films

# Créer le venv
python3 -m venv venv

# Activer le venv
source venv/bin/activate
```

### 3. Installer les dépendances Python

```bash
# Dans le venv activé
pip install python-dotenv prisma ffmpeg-normalize requests yt-dlp static-ffmpeg tqdm
```

---

## 🚀 Lancer la normalisation

```bash
# S'assurer que le venv est activé
source venv/bin/activate

# Lancer le script
python scripts/normalize_all_audio.py
```

Le script va :
- ✅ Parcourir tous les fichiers MP3 dans `public/audio/`
- ✅ Normaliser chacun à **-16 LUFS**
- ✅ Afficher une barre de progression
- ✅ Remplacer les fichiers originaux

---

## ⚙️ Paramètres de normalisation

| Paramètre | Valeur |
|-----------|--------|
| **Norme** | EBU R128 (standard professionnel) |
| **Cible** | -16 LUFS (volume optimal streaming) |
| **Codec** | MP3 libmp3lame |
| **Bitrate** | 192 kbps |
| **Sample rate** | 44100 Hz |

---

## 📊 Résultat attendu

```
============================================================
Résumé de la normalisation
============================================================
Total:       1232
Succès:      1232
Échecs:      0
Ignorés:     0
============================================================

✅ 1232 fichiers normalisés avec succès à -16 LUFS !
```

---

## ⚠️ Important

- **Backup** : Le script remplace les fichiers originaux. Faites une copie si nécessaire.
- **Durée** : Compter environ 1-2 secondes par fichier (≈ 20-40 min pour 1200 fichiers).
- **Espace disque** : Prévoir de l'espace pour les fichiers temporaires.

---

## 🔧 Dépannage

### Erreur : "Could not find ffmpeg"

```bash
# Vérifier que ffmpeg est installé
which ffmpeg

# Si absent, installer
sudo apt install ffmpeg
```

### Erreur : "ModuleNotFoundError: No module named 'dotenv'"

```bash
# Activer le venv
source venv/bin/activate

# Installer les dépendances
pip install python-dotenv ffmpeg-normalize
```

### Erreur : "externally-managed-environment"

Utilisez un environnement virtuel (voir section Prérequis ci-dessus).

---

## 📝 Commandes rapides (résumé)

```bash
# Setup (une fois)
sudo apt install ffmpeg
python3 -m venv venv
source venv/bin/activate
pip install python-dotenv prisma ffmpeg-normalize requests yt-dlp tqdm

# Normaliser tous les fichiers
source venv/bin/activate
python scripts/normalize_all_audio.py
deactivate
```

---

## 🎯 Vérification post-normalisation

Après la normalisation, vous pouvez vérifier un fichier avec :

```bash
# Installer ffmpeg-loudness
pip install pyloudnorm

# Vérifier le niveau LUFS d'un fichier
ffmpeg -i public/audio/exemple.mp3 -af loudnorm=print_format=summary -f null -
```

Le fichier devrait être proche de **-16.0 LUFS**.
