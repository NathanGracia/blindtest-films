# CLAUDE.md - Blindtest Films

## Apercu rapide

Application de blindtest musical pour films/series/jeux/anime. Style Skribbl.io avec système de rooms multijoueur temps réel (parties privées ou publique).

**Stack** : Next.js 16 + React 19 + Socket.IO + Prisma SQLite + Tailwind CSS + Python (import)

---

## Commandes essentielles

```bash
# Developpement
npm run dev              # Serveur dev (port 3000) - inclut Socket.IO
npm run build            # Build production
npm start                # Serveur production

# Base de donnees
npx prisma studio        # Interface graphique DB (localhost:5555)
npx prisma migrate dev   # Creer migration
npx prisma db seed       # Init categories

# Import de contenu (Python)
python scripts/fixtures.py --categories films              # Importer films
python scripts/fixtures.py --categories films --limit 10   # Limiter
python scripts/clear_tracks.py                             # Vider tracks

# Gestion des utilisateurs
node scripts/make_admin.js <username>   # Passer un user en admin (prod)

# Docker
docker-compose up -d     # Lancer app + Caddy HTTPS
```

---

## Architecture du projet

```
blindtest-films/
├── app/                          # Next.js App Router
│   ├── page.tsx                 # Accueil (pseudo + créer/rejoindre parties)
│   ├── multi/
│   │   └── [roomCode]/page.tsx  # Salle de jeu (WebSocket)
│   ├── admin/                   # Interface admin protegee
│   │   ├── tracks/              # CRUD tracks
│   │   └── categories/          # CRUD categories
│   └── api/
│       ├── tracks/route.ts      # GET tracks publics
│       ├── categories/route.ts  # GET categories
│       ├── auth/                # Login/logout admin
│       └── admin/               # Routes admin protegees
│
├── components/                  # Composants React
│   ├── AudioPlayer.tsx         # Lecteur audio + disque anime
│   ├── AnswerInput.tsx         # Input + historique tentatives
│   ├── Timer.tsx               # Barre temps restant
│   ├── CategorySelector.tsx    # Selection categories
│   └── admin/                  # Composants admin
│
├── lib/
│   ├── data.ts                 # CRUD Prisma
│   ├── auth.ts                 # Gestion sessions admin
│   ├── socket.ts               # Client Socket.IO singleton
│   ├── prisma.ts               # Instance Prisma
│   └── utils.ts                # Levenshtein, normalisation, shuffle
│
├── prisma/
│   ├── schema.prisma           # Schema DB
│   └── dev.db                  # Base SQLite
│
├── public/
│   ├── audio/                  # Fichiers MP3
│   ├── images/                 # Affiches films
│   └── avatars/                # Photos de profil uploadées
│
├── scripts/                    # Import Python + utilitaires Node
│   ├── fixtures.py             # Orchestrateur principal
│   ├── data/films_list.json    # Liste films a importer
│   ├── utils/                  # OMDb, YouTube, answers
│   └── make_admin.js           # Promouvoir un user en admin
│
├── server.js                   # Serveur Node + Socket.IO
├── middleware.ts               # Protection routes admin
└── docker-compose.yml          # Orchestration Docker
```

---

## Système de comptes utilisateurs

### Vue d'ensemble

Les joueurs peuvent créer un compte (login + mot de passe) pour sauvegarder leurs scores, avoir un profil public et une photo de profil. Les guests peuvent toujours jouer sans compte.

### Authentification

- **Token** : format `userId:expiresAt:hmac` signé HMAC-SHA256 avec `ADMIN_PASSWORD` comme secret
- **Cookie** : `blindtoss_user_session` (httpOnly, 30 jours)
- **Hash mdp** : Node.js `crypto.scrypt` (pas bcryptjs — incompatible ESM avec Next.js 16)
- **Fichier** : `lib/userAuth.ts` — `signUserToken`, `verifyUserToken`, `hashPassword`, `comparePassword`, `getCurrentUser`

### Routes API utilisateur

```
POST /api/user/register     # Créer un compte
POST /api/user/login        # Connexion (pose blindtoss_user_session + blindtoss_admin_session si isAdmin)
POST /api/user/logout       # Déconnexion (efface les deux cookies)
GET  /api/user/me           # Utilisateur courant (id, username, displayName, avatarFile, isAdmin)
PATCH /api/user/profile     # Modifier displayName et/ou mot de passe
POST /api/user/avatar       # Uploader une photo de profil (JPG/PNG/WebP, max 5 Mo)
```

### Profils

- **URL publique** : `/profile/[username]` — stats ladder, historique des 20 dernières parties
- **Édition** : `/profile/edit` — pseudo affiché, mot de passe, photo de profil
- **Composant avatar** : `components/UserAvatar.tsx` — carré arrondi style Vista, couleur pastel déterministe si pas de photo, reflet vitré CSS

### Intégration en jeu (server.js)

Au moment de la connexion Socket.IO, le cookie est lu et vérifié (synchrone). La DB est interrogée en parallèle via `displayNamePromise` (pattern non-bloquant) pour récupérer `displayName` et `avatarFile`. Ces données sont stockées dans l'objet `player` et incluses dans tous les events (`room:state`, `room:player-joined`, `chat:message`).

```js
// Pattern clé — NE PAS mettre await avant l'enregistrement des handlers
let displayNamePromise = Promise.resolve({ displayName: null, avatarFile: null });
if (tokenValide) {
  displayNamePromise = prisma.user.findUnique({ select: { displayName, avatarFile } });
}
socket.on('room:join', async (...) => {
  const { displayName, avatarFile } = await displayNamePromise; // await ICI seulement
});
```

### Système admin utilisateurs

- **Champ** : `User.isAdmin` (Boolean, default false)
- **Accès back-office** : à la connexion, si `isAdmin: true` → cookie `blindtoss_admin_session` posé automatiquement
- **Interface** : `/admin/users` — tableau des comptes avec bouton "Passer admin" / "Retirer admin"
- **En production** : `node scripts/make_admin.js <username>` après création du compte

---

## Schema base de donnees

```prisma
model Category {
  id     String  @id          // "films", "series", "jeux", "anime"
  name   String               // "Films"
  icon   String               // "film"
  color  String               // "#4a90d9"
  tracks Track[]
}

model Track {
  id              Int      @id @default(autoincrement())
  title           String                  // Titre VO
  titleVF         String?                 // Titre VF (optionnel)
  acceptedAnswers String                  // JSON: ["reponse1","reponse2"]
  audioFile       String                  // /audio/film-123.mp3
  imageFile       String?                 // /images/film-123.jpg
  timeLimit       Int      @default(30)   // Secondes
  startTime       Int      @default(0)    // Debut lecture audio
  reportCount     Int      @default(0)    // Signalements
  categoryId      String
  category        Category @relation(...)
}
```

---

## Logique metier cle

### Systeme de score
```
score = 100 + (800 * tempsRestant / tempsMax)
// Max: 1000 (instantane), Min: 100 (temps ecoule)
// Multijoueur: +200 bonus premier a trouver
```

### Verification reponses (lib/utils.ts)
1. Normalisation : minuscules, sans accents, trim
2. Match exact dans `acceptedAnswers`
3. Distance Levenshtein <= 2 : affiche "Vous etes proche !"

### Systeme de vies (server.js + page.tsx)
**Objectif** : Limiter les tentatives via suggestions pour éviter le spam

**Fonctionnement** :
- Chaque joueur a **3 vies** par track (reset à chaque round)
- Les vies sont affichées en cœurs : ❤️❤️❤️ / ❤️❤️🖤 / ❤️🖤🖤 / 🖤🖤🖤
- **Perte de vie** : réponse incorrecte qui correspond à un titre VO ou VF exact d'un track de la catégorie
- **Pas de perte** : saisie libre qui ne correspond pas à un titre exact

**Logique serveur** :
```javascript
// Cache global chargé au démarrage
let allTracksCache = []; // Tous les tracks en mémoire

// Vérification automatique côté serveur
function isAnswerFromSuggestion(answer, categoryId) {
  const normalized = normalizeAnswer(answer);
  return allTracksCache.some(track =>
    track.categoryId === categoryId &&
    (normalizeAnswer(track.title) === normalized ||
     normalizeAnswer(track.titleVF) === normalized)
  );
}

// Dans game:answer handler
if (isAnswerFromSuggestion(answer, currentTrack.categoryId) && !isCorrect) {
  socket.emit('game:wrong-answer'); // Déclenche perte de vie côté client
}
```

**Logique client** :
- État `remainingLives` (3 → 2 → 1 → 0)
- Listener `game:wrong-answer` décrémente les vies
- Dropdown de suggestions masqué si `remainingLives === 0`
- Chat toujours actif même à 0 vie (permet discussion et saisie libre)

**Avantages** :
- ✅ Vérification côté serveur = impossible à contourner
- ✅ Comparaison directe avec les vrais titres (pas de tracking de flag)
- ✅ Simple et fiable : titre exact = suggestion, sinon = chat libre

### Multijoueur (server.js)
- Room publique "PUBLIC" : permanente, 25 tracks, countdown 30s
- Rooms privees : code 6 caracteres (ABC123)
- Events Socket.IO : `room:join`, `game:start`, `game:tick`, `game:round-end`, `game:end`

---

## Routes API principales

```
# Publiques
GET  /api/tracks?categories=films,series   # Tracks filtres
GET  /api/categories                       # Categories avec counts
POST /api/tracks/[id]/report               # Signaler track

# Admin (protegees par middleware)
GET/POST   /api/admin/tracks               # CRUD tracks
GET/PATCH/DELETE /api/admin/tracks/[id]
GET/POST   /api/admin/categories           # CRUD categories
POST       /api/admin/upload               # Upload audio/images
POST       /api/auth/login                 # Connexion admin
```

---

## Variables d'environnement

```env
DATABASE_URL="file:./dev.db"
ADMIN_PASSWORD=xxx           # Mot de passe interface admin
OMDB_API_KEY=xxx             # API OMDb (metadonnees films)
IMPORT_API_TOKEN=xxx         # Token scripts Python (defaut: ADMIN_PASSWORD)
```

---

## Conventions de code

- **TypeScript strict** : types explicites, interfaces pour structures (Category, Track, Player, RoomState)
- **React** : `'use client'` pour composants interactifs, useCallback pour optimisation
- **Tailwind** : classes utilitaires, design Frutiger Aero (`.glass`, `.btn-aero`, `.glow-blue`)
- **API routes** : `NextResponse.json({ error }, { status })` pour erreurs
- **Nommage** : PascalCase composants, camelCase variables, UPPER_SNAKE_CASE constantes

---

## Points d'attention

1. **server.js** gere Socket.IO - ne pas confondre avec les API routes Next.js
2. **middleware.ts** protege `/admin` et `/api/admin` - verifie cookie `blindtest_admin_session`
3. **acceptedAnswers** est stocke en JSON string, pas en array natif
4. **Scripts Python** necessitent le serveur Next.js lance (pour POST /api/import)
5. **public/audio** et **public/images** sont volumineux et montes en volumes Docker

---

## Flux de jeu

Tous les modes de jeu utilisent le système multijoueur (rooms). Un joueur seul = une room avec 1 joueur.
Tout se passe depuis la page d'accueil, plus besoin de page intermédiaire /multi.

### Créer une partie privée
```
Accueil → Pseudo + Catégories + Rounds
→ Bouton "Créer partie privée" → room:create (Socket.IO)
→ Redirection /multi/[roomCode] (ex: ABC123)
→ game:start → AudioPlayer + Timer + Chat
→ Saisie réponse → Broadcast → Score
→ game:round-end → game:end → Classement final
```

### Rejoindre partie publique
```
Accueil → Pseudo
→ Bouton "Rejoindre partie publique" → room:join PUBLIC (Socket.IO)
→ Redirection /multi/PUBLIC
→ Attente autres joueurs ou démarrage automatique
→ game:start → game:tick → Classement en temps réel
```

### Rejoindre partie privée (via code)
```
Accueil → Pseudo + "Rejoindre avec un code"
→ Input code room (ex: ABC123) → room:join [CODE] (Socket.IO)
→ Redirection /multi/[CODE]
→ Jeu avec catégories définies par l'hôte
```
