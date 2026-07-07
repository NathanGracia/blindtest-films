# CLAUDE.md - Blindtest Films

## Apercu rapide

Application de blindtest musical pour films/series/jeux/anime. Style Skribbl.io avec système de rooms multijoueur temps réel (parties privées ou publique).

**Stack** : Next.js 16 + React 19 + Socket.IO + Prisma SQLite + Tailwind CSS + Python (import)

---

## Commandes essentielles

```bash
# Developpement
npm run dev              # Serveur dev (port 3001) - inclut Socket.IO
npm run build            # Build production
npm start                # Serveur production

# Base de donnees
npx prisma studio        # Interface graphique DB (localhost:5555)
npx prisma migrate dev   # Creer migration
npx prisma db seed       # Init categories

# Import de contenu (Python) - voir scripts/CSV_IMPORT.md
python scripts/feeder.py data/mon_import.csv                       # Hydrate la BDD locale (telecharge YouTube en local)
python scripts/feeder.py data/mon_import.csv --limit 10            # Limiter
python scripts/feeder.py data/mon_import.csv --targets local vps   # Hydrate aussi le VPS
python scripts/clear_tracks.py                                     # Vider tracks

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
│   ├── TrackHistoryPanel.tsx   # Sidebar gauche historique + notes
│   ├── RevealImage.tsx         # Affiche animée au reveal
│   ├── UserAvatar.tsx          # Avatar carré arrondi style Vista
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
│   ├── feeder.py                # Import CSV : telecharge YouTube en local, hydrate BDD locale et/ou VPS
│   ├── clear_tracks.py          # Vider tous les tracks
│   ├── data/                    # CSV source (title,titleVF,youtube_url,category_id)
│   ├── utils/                   # YouTube, answers, csv_parser, api_client
│   └── make_admin.js            # Promouvoir un user en admin
│
├── server.js                   # Serveur Node + Socket.IO
├── middleware.ts               # Protection routes admin
└── docker-compose.yml          # Orchestration Docker
```

---

## Système de comptes utilisateurs — géré par cooloss

**Le compte (login, mot de passe, avatar, displayName, isAdmin) n'est plus géré ici.** Depuis juillet 2026, l'identité est centralisée dans une app dédiée, **cooloss** (`https://cooloss.nathangracia.com`, repo `NathanGracia/cooloss`), partagée avec Memoss et toute future app "-oss". Voir `~/docs/compte-unifie-cooloss.md` sur le VPS pour l'architecture complète du système partagé — cette section ne couvre que ce qui reste spécifique à Blindtoss.

### Vue d'ensemble

Se connecter sur cooloss (ou sur n'importe quelle app "-oss") connecte automatiquement partout ailleurs, via un cookie partagé sur `.nathangracia.com`. Les guests peuvent toujours jouer sans compte, comme avant.

### Authentification

- **Token** : cookie `nathangracia_session`, format `<payload base64url>.<hmac hex>`, HMAC-SHA256 signé avec `SHARED_SESSION_SECRET` (secret dédié, distinct de `ADMIN_PASSWORD`). Payload : `{ uid, username, displayName, isAdmin, avatarFile, exp }`.
- **Fichiers** :
  - `lib/sharedAuth.ts` (runtime Node, route handlers) — vérifie le cookie et fait un **upsert-miroir** dans la table `User` locale à chaque requête authentifiée (`getCurrentUser()`, `getCurrentUserId()`).
  - `lib/sharedAuthEdge.ts` (runtime Edge, `middleware.ts` uniquement) — même vérification en Web Crypto (`crypto.subtle`), pas de DB, juste pour checker `isAdmin` sur `/admin/*`.
- **Pourquoi un miroir local** : `GameResult`/`UserAchievement`/`UserTrackNote` ont de vraies FK SQLite vers `User.id`, et SQLite ne supporte pas les FK inter-bases — la ligne doit exister localement même si cooloss est la source de vérité. `User.passwordHash` local n'est plus jamais lu, juste présent pour satisfaire la contrainte NOT NULL du schéma (toujours `''`).

### Routes API utilisateur restantes

```
POST /api/user/logout       # Efface le cookie partagé (Domain=.nathangracia.com) — fonctionne
                             # localement, n'importe quel sous-domaine peut clear ce cookie
GET  /api/user/me           # Utilisateur courant (mirroré), pour affichage côté client
```

Login/register/changement de mot de passe/avatar/displayName : **tout sur cooloss**, plus aucune route locale (`/api/user/login`, `register`, `avatar`, `PATCH /api/user/profile` supprimées).

### Profils

- **URL publique** : `/profile/[username]` — stats ladder, historique des 20 dernières parties (données locales, inchangé)
- **Édition** : lien direct vers `https://cooloss.nathangracia.com/profile/edit` (avatar, displayName, mot de passe) — plus de page locale
- **Composant avatar** : `components/UserAvatar.tsx` — inchangé, `avatarFile` est maintenant toujours une URL absolue (`https://cooloss.nathangracia.com/avatars/...`)

### Intégration en jeu (server.js)

Au moment de la connexion Socket.IO, le cookie `nathangracia_session` est lu et vérifié (synchrone, HMAC-SHA256 avec `SHARED_SESSION_SECRET`). Le miroir local (`prisma.user.upsert`) est fait en parallèle via `displayNamePromise` (pattern non-bloquant, inchangé) pour récupérer `displayName`/`avatarFile` à jour. Ces données sont stockées dans l'objet `player` et incluses dans tous les events (`room:state`, `room:player-joined`, `chat:message`).

```js
// Pattern clé — NE PAS mettre await avant l'enregistrement des handlers
let displayNamePromise = Promise.resolve({ username: null, displayName: null, avatarFile: null });
if (tokenValide) {
  displayNamePromise = prisma.user.upsert({ where: { id: claims.uid }, update: {...}, create: {...} })
    .then(u => ({ username: u.username, displayName: u.displayName, avatarFile: u.avatarFile }));
}
socket.on('room:join', async (...) => {
  const { displayName, avatarFile } = await displayNamePromise; // await ICI seulement
});
```

### Système admin utilisateurs

- **Champ** : `User.isAdmin` — géré sur **cooloss** (`https://cooloss.nathangracia.com/admin`), pas ici. Le flag arrive dans le token à chaque login et se propage au miroir local automatiquement.
- **Accès back-office local** : `middleware.ts` checke `claims.isAdmin` (via `lib/sharedAuthEdge.ts`) sur `/admin/*` et `/api/admin/*` — pas de cookie admin séparé.
- **`/admin/users`** : liste en lecture seule (miroir local) — toggle admin retiré (modifiait la copie locale seulement, écrasée au login suivant). Lien vers cooloss pour la vraie gestion.
- **`scripts/make_admin.js` supprimé** — cette action se fait sur cooloss maintenant.

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
  difficulty      String?                 // "easy" | "medium" | "hard" | null
  categoryId      String
  category        Category @relation(...)
  reports         Report[]
  notes           UserTrackNote[]
}

model Report {
  id        Int      @id @default(autoincrement())
  trackId   Int
  track     Track    @relation(onDelete: Cascade)
  message   String   @default("")
  createdAt DateTime @default(now())
}

model UserTrackNote {
  id        Int      @id @default(autoincrement())
  userId    Int
  trackId   Int
  note      String   @default("")    // Max 100 chars (enforced server-side)
  updatedAt DateTime @updatedAt
  @@unique([userId, trackId])
}

model GameResult {
  id           Int      @id @default(autoincrement())
  userId       Int
  score        Int
  rank         Int
  totalPlayers Int
  tracksFound  Int
  totalTracks  Int
  categories   String   // JSON ["films","series"]
  roomCode     String
  playedAt     DateTime @default(now())
}

model LadderEntry {
  pseudo      String
  bestScore   Int
  weekId      String   // "2026-W04"
  lastGameAt  DateTime
  gamesPlayed Int
  @@unique([pseudo, weekId])
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

### Système de notes (server.js + TrackHistoryPanel)

Les utilisateurs connectés peuvent annoter chaque track joué (trigger, indice...) dans la sidebar historique.

- **Stockage** : `UserTrackNote` (userId + trackId unique, 100 chars max)
- **Chargement** : `note:load` (avec ack callback) émis sur `game:round-end`
- **Sauvegarde** : debounce 1.5s sur `onChange` + `onBlur` immédiat + flush forcé sur `game:start` et `game:end`
- **Feedback** : "✓ Sauvegardé" affiché en permanence après save, "Envoi..." pendant le transit
- **Guest** : textarea masquée, message global "Connectez-vous pour enregistrer des notes"
- **Détection login** : `/api/user/me` retourne `{ user: null }` pour les guests → vérifier `data.user !== null`

```js
// Events Socket.IO notes
socket.on('note:load', async ({ trackId }, callback) => { ... }) // callback({ note })
socket.on('note:save', async ({ trackId, note }) => { ... })     // émet note:saved
socket.emit('note:saved', { trackId })
```

### Système de signalement

- **POST /api/tracks/[id]/report** : incrémente `reportCount` ET crée un `Report` (avec message)
- **GET /api/admin/tracks/[id]/reports** : liste les reports d'un track (admin)
- **Interface admin** : ligne expandable dans `/admin/tracks` avec date + message par report
- **Reset** : remet `reportCount` à 0 ET supprime les `Report` associés

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
POST /api/tracks/[id]/report               # Signaler track (+ message)
GET  /api/answers?categories=...           # Titres pour suggestions (autocomplete)

# Utilisateur
POST /api/user/register                    # Créer un compte
POST /api/user/login                       # Connexion
POST /api/user/logout                      # Déconnexion
GET  /api/user/me                          # Utilisateur courant ({ user: null } si guest)
PATCH /api/user/profile                    # Modifier displayName / mot de passe
POST /api/user/avatar                      # Upload photo de profil

# Admin (protegees par middleware)
GET/POST   /api/admin/tracks               # CRUD tracks
GET/PATCH/DELETE /api/admin/tracks/[id]
GET        /api/admin/tracks/[id]/reports  # Reports d'un track
GET/POST   /api/admin/categories           # CRUD categories
POST       /api/admin/upload               # Upload audio/images
POST       /api/auth/login                 # Connexion admin
```

---

## Variables d'environnement

```env
DATABASE_URL="file:./dev.db"
ADMIN_PASSWORD=xxx           # Mot de passe interface admin
IMPORT_API_TOKEN=xxx         # Token scripts Python (defaut: ADMIN_PASSWORD)
OMDB_API_KEY=xxx             # Optionnel - affiches officielles pour la categorie "films" (scripts/feeder.py)
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
6. **Port dev** : 3001 (pas 3000, pris par un autre projet)
7. **/api/user/me** retourne toujours HTTP 200 — tester `data.user !== null` pour savoir si connecté
8. **Notes** : flush forcé sur `game:start` ET `game:end` via `noteDebounceRef` + `trackNotesRef`
9. **Serving des médias uploadés à chaud** : voir section dédiée ci-dessous — règle volume Docker **+** `location` Nginx, sinon 404.

---

## Serving des médias uploadés (audio / images / emotes / avatars)

⚠️ **Next.js en mode standalone indexe `public/` au boot et ne sert JAMAIS les fichiers ajoutés au volume après le démarrage du conteneur** → tout fichier uploadé/poussé à chaud renvoie **404** sur son URL statique `/<dossier>/<fichier>`.

C'est pour ça que les médias **ne sont PAS servis par Next** mais par **Nginx en frontal**, directement depuis le disque. Tout dossier de médias uploadés à l'exécution doit avoir **les deux** :

1. **Un volume Docker** dans `docker-compose.yml` (sinon l'écriture du conteneur ne persiste pas sur le host) :
   `./public/audio`, `./public/images`, `./public/emotes`, `./public/avatars` (+ `./prisma`).
2. **Un bloc `location` dans le vhost Nginx** `/etc/nginx/sites-available/blindtoss` (root `/opt/blindtest-films/public`, cache 30j) :
   `location /audio/`, `/images/`, `/emotes/`, `/avatars/`.

> **Règle à retenir : tout nouveau dossier de médias uploadés à chaud = (1) volume Docker + (2) `location` Nginx. Aucun code applicatif n'est nécessaire** (la valeur en DB est l'URL statique, ex. `avatarFile = /avatars/<file>`, servie par Nginx).
>
> Ne PAS résoudre ça avec une route API Next qui stream le fichier : la convention du projet est Nginx. (`/api/audio/[id]` existe pour des raisons historiques mais n'est pas le pattern cible.)

**Important** : `docker-compose.yml` (version Nginx, sans Caddy) et le vhost Nginx sont **modifiés localement sur le VPS et volontairement NON commités** (le repo garde la version Caddy). Ces deux fichiers vivent uniquement sur le serveur — ne pas committer.

Cas réel (26/06/2026) — upload de photo de profil cassé : il manquait à la fois le volume `./public/avatars` et le `location /avatars/`. Fix = ajout des deux, aucun changement de code.

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
