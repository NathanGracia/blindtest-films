require('dotenv').config();

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const prisma = new PrismaClient();

// Code de la room publique permanente
const PUBLIC_ROOM_CODE = 'PUBLIC';

// Calculer l'identifiant de semaine ISO (année-semaine)
function getWeekId(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// Sauvegarder le score dans le ladder (upsert)
async function saveLadderScore(pseudo, score) {
  if (!pseudo || score <= 0) return;

  const normalizedPseudo = pseudo.trim().toLowerCase();
  const weekId = getWeekId();

  try {
    const existing = await prisma.ladderEntry.findUnique({
      where: {
        pseudo_weekId: {
          pseudo: normalizedPseudo,
          weekId,
        },
      },
    });

    if (existing) {
      // Mettre à jour seulement si nouveau score > ancien
      if (score > existing.bestScore) {
        await prisma.ladderEntry.update({
          where: {
            pseudo_weekId: {
              pseudo: normalizedPseudo,
              weekId,
            },
          },
          data: {
            bestScore: score,
            lastGameAt: new Date(),
            gamesPlayed: { increment: 1 },
          },
        });
        console.log(`[LADDER] ${pseudo}: nouveau best ${score} (semaine ${weekId})`);
      } else {
        await prisma.ladderEntry.update({
          where: {
            pseudo_weekId: {
              pseudo: normalizedPseudo,
              weekId,
            },
          },
          data: {
            gamesPlayed: { increment: 1 },
          },
        });
      }
    } else {
      // Créer nouveau record
      await prisma.ladderEntry.create({
        data: {
          pseudo: normalizedPseudo,
          bestScore: score,
          weekId,
          gamesPlayed: 1,
        },
      });
      console.log(`[LADDER] ${pseudo}: première entrée ${score} pts (${weekId})`);
    }
  } catch (error) {
    console.error('[LADDER] Erreur sauvegarde:', error);
  }
}

// Calcul de la distance de Levenshtein (nombre de modifications nécessaires)
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,    // suppression
          dp[i][j - 1] + 1,    // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return dp[m][n];
}

// Charger les tracks depuis la base de données
async function loadTracks() {
  const tracks = await prisma.track.findMany();
  return tracks.map(track => ({
    ...track,
    acceptedAnswers: JSON.parse(track.acceptedAnswers),
  }));
}

// Cache global de tous les tracks pour vérification des suggestions
let allTracksCache = [];

// Vérifier si la réponse correspond à un titre VO ou VF d'un track de la catégorie
function isAnswerFromSuggestion(answer, categoryId) {
  const normalizedAnswer = normalizeAnswer(answer);

  // Chercher dans les tracks de la catégorie actuelle
  for (const track of allTracksCache) {
    if (track.categoryId !== categoryId) continue;

    // Vérifier titre VO
    if (normalizeAnswer(track.title) === normalizedAnswer) {
      return true;
    }

    // Vérifier titre VF si disponible
    if (track.titleVF && normalizeAnswer(track.titleVF) === normalizedAnswer) {
      return true;
    }
  }

  return false;
}

// Stockage des rooms en mémoire
const rooms = new Map();

// Créer la room publique permanente
async function createPublicRoom() {
  try {
    const allTracks = await loadTracks();

    // Grouper par catégorie
    const tracksPerCategory = {};
    for (const track of allTracks) {
      if (!tracksPerCategory[track.categoryId]) {
        tracksPerCategory[track.categoryId] = [];
      }
      tracksPerCategory[track.categoryId].push(track);
    }

    // Distribution équitable entre toutes les catégories disponibles
    const allCategories = Object.keys(tracksPerCategory);
    const limitedTracks = distributeTracksEquitably(allCategories, 25, tracksPerCategory);

    const publicRoom = {
      code: PUBLIC_ROOM_CODE,
      players: [],
      currentTrackIndex: 0,
      isPlaying: false,
      hostId: null, // Pas de host pour la room publique
      tracks: limitedTracks,
      categories: [], // Toutes les catégories
      timer: null,
      timeRemaining: 30,
      roundFinders: new Set(), // Joueurs qui ont trouvé ce round
      deletionTimer: null,
      isPublic: true,
      startCountdown: null,
      startCountdownValue: 10,
      categoryStats: {}, // Stats par joueur: { playerId: { categoryId: count } }
    };
    rooms.set(PUBLIC_ROOM_CODE, publicRoom);
    console.log(`Room publique ${PUBLIC_ROOM_CODE} créée avec ${limitedTracks.length} tracks répartis équitablement`);
    return publicRoom;
  } catch (error) {
    console.error('Erreur création room publique:', error);
  }
}

// Générer un code de room aléatoire
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Normaliser une réponse (comme côté client)
function normalizeAnswer(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

// Vérifier une réponse
function checkAnswer(input, acceptedAnswers) {
  const normalizedInput = normalizeAnswer(input);
  return acceptedAnswers.some(
    (answer) => normalizeAnswer(answer) === normalizedInput
  );
}

// Calculer le score basé sur le temps restant (style Skribbl.io)
function calculateScore(timeRemaining, timeLimit, isFirstFinder) {
  const MIN_SCORE = 100;
  const MAX_SCORE = 1000;
  const FIRST_BONUS = 200;

  const timeRatio = timeRemaining / timeLimit;
  let score = Math.floor(MIN_SCORE + (MAX_SCORE - MIN_SCORE) * timeRatio);

  if (isFirstFinder) {
    score += FIRST_BONUS;
  }

  return score;
}

// Mélanger un tableau
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Distribuer équitablement les tracks entre catégories
function distributeTracksEquitably(categories, totalRounds, tracksPerCategory) {
  if (categories.length === 0) {
    return [];
  }

  // Shuffler chaque catégorie AVANT la sélection pour avoir de la variété
  const shuffledTracksPerCategory = {};
  for (const cat of categories) {
    if (tracksPerCategory[cat]) {
      shuffledTracksPerCategory[cat] = shuffleArray(tracksPerCategory[cat]);
    }
  }

  const numCategories = categories.length;
  const basePerCategory = Math.floor(totalRounds / numCategories);
  const remainder = totalRounds % numCategories;

  const result = [];
  let remainingRounds = totalRounds;

  // Phase 1: Assigner le quota de base à chaque catégorie
  for (const cat of categories) {
    const available = shuffledTracksPerCategory[cat]?.length || 0;
    const toTake = Math.min(basePerCategory, available);

    if (toTake > 0) {
      result.push(...shuffledTracksPerCategory[cat].slice(0, toTake));
      remainingRounds -= toTake;
    }
  }

  // Phase 2: Distribuer le reste aux catégories qui ont encore de la capacité
  let categoryIndex = 0;
  while (remainingRounds > 0 && categoryIndex < categories.length * 10) { // Protection contre boucle infinie
    const cat = categories[categoryIndex % categories.length];
    const available = shuffledTracksPerCategory[cat]?.length || 0;
    const alreadyTaken = result.filter(t => t.categoryId === cat).length;

    if (alreadyTaken < available) {
      result.push(shuffledTracksPerCategory[cat][alreadyTaken]);
      remainingRounds--;
    }
    categoryIndex++;
  }

  const shuffled = shuffleArray(result);
  return shuffled;
}

// Filtrer les tracks par catégories
function filterTracksByCategories(tracks, categoryIds) {
  if (!categoryIds || categoryIds.length === 0) {
    return tracks;
  }
  return tracks.filter(track => categoryIds.includes(track.categoryId));
}

// Variable pour stocker io globalement (nécessaire pour les fonctions de la room publique)
let ioInstance = null;

// Démarrer le countdown de la room publique
function startPublicRoomCountdown(room) {
  if (room.startCountdown) return; // Déjà en cours

  room.startCountdownValue = 10;
  console.log(`Countdown room publique démarré`);

  room.startCountdown = setInterval(async () => {
    room.startCountdownValue--;

    if (ioInstance) {
      ioInstance.to(PUBLIC_ROOM_CODE).emit('public:countdown', room.startCountdownValue);
    }

    if (room.startCountdownValue <= 0) {
      clearInterval(room.startCountdown);
      room.startCountdown = null;
      await startPublicGame(room);
    }
  }, 1000);
}

// Arrêter le countdown de la room publique
function stopPublicRoomCountdown(room) {
  if (room.startCountdown) {
    clearInterval(room.startCountdown);
    room.startCountdown = null;
    room.startCountdownValue = 10;
    console.log(`Countdown room publique arrêté`);
  }
}

// Démarrer la partie de la room publique
async function startPublicGame(room) {
  if (!ioInstance) return;

  try {
    const allTracks = await loadTracks();

    // Grouper par catégorie
    const tracksPerCategory = {};
    for (const track of allTracks) {
      if (!tracksPerCategory[track.categoryId]) {
        tracksPerCategory[track.categoryId] = [];
      }
      tracksPerCategory[track.categoryId].push(track);
    }

    // Distribution équitable entre toutes les catégories
    const allCategories = Object.keys(tracksPerCategory);
    room.tracks = distributeTracksEquitably(allCategories, 25, tracksPerCategory);
    room.currentTrackIndex = 0;
    room.isPlaying = true;
    room.roundFinders = new Set();
    room.categoryStats = {}; // Reset stats de catégories

    // Reset scores et états des joueurs
    room.players.forEach(p => {
      p.score = 0;
      p.hasFoundThisRound = false;
    });

    const currentTrack = room.tracks[room.currentTrackIndex];
    room.timeRemaining = currentTrack.timeLimit;

    ioInstance.to(PUBLIC_ROOM_CODE).emit('game:start', {
      trackIndex: room.currentTrackIndex,
      trackId: currentTrack.id,
      imageFile: currentTrack.imageFile,
      timeLimit: currentTrack.timeLimit,
      startTime: currentTrack.startTime || 0,
      totalTracks: room.tracks.length,
      categoryId: currentTrack.categoryId,
    });

    // Démarrer le timer
    startTimerPublic(room);

    console.log(`Partie publique lancée avec ${room.tracks.length} tracks`);
  } catch (error) {
    console.error('Erreur lancement partie publique:', error);
  }
}

// Timer spécifique pour la room publique
function startTimerPublic(room) {
  if (room.timer) clearInterval(room.timer);

  room.timer = setInterval(() => {
    room.timeRemaining--;

    if (ioInstance) {
      ioInstance.to(PUBLIC_ROOM_CODE).emit('game:tick', room.timeRemaining);
    }

    if (room.timeRemaining <= 0) {
      clearInterval(room.timer);
      room.timer = null;

      // Fin du round - révéler la réponse à tous
      const currentTrack = room.tracks[room.currentTrackIndex];
      const finders = Array.from(room.roundFinders).map(id => {
        const p = room.players.find(player => player.id === id);
        return p ? { id, pseudo: p.pseudo } : null;
      }).filter(Boolean);

      if (ioInstance) {
        ioInstance.to(PUBLIC_ROOM_CODE).emit('game:round-end', {
          trackId: currentTrack.id,
          title: currentTrack.title,
          titleVF: currentTrack.titleVF,
          imageFile: currentTrack.imageFile,
          finders,
          players: room.players,
          totalFound: room.roundFinders.size,
        });
      }

      // Passer au suivant après 3 secondes
      setTimeout(() => nextTrackPublic(room), 3000);
    }
  }, 1000);
}

// Passer au track suivant pour la room publique
async function nextTrackPublic(room) {
  room.currentTrackIndex++;
  room.roundFinders = new Set();
  room.players.forEach(p => p.hasFoundThisRound = false);

  // Si fin des tracks (25 œuvres), fin de partie
  if (room.currentTrackIndex >= room.tracks.length) {
    room.isPlaying = false;
    if (room.timer) {
      clearInterval(room.timer);
      room.timer = null;
    }

    // NOUVEAU: Sauvegarder les scores dans le ladder
    const sortedPlayers = room.players.sort((a, b) => b.score - a.score);
    for (const player of sortedPlayers) {
      if (player.score > 0) {
        await saveLadderScore(player.pseudo, player.score);
      }
    }

    if (ioInstance) {
      ioInstance.to(PUBLIC_ROOM_CODE).emit('game:end', {
        players: sortedPlayers,
        categoryStats: room.categoryStats,
      });
    }
    console.log(`Room publique: partie terminée, ${room.players.length} joueurs`);

    // Lancer le countdown pour une nouvelle partie après 10 secondes
    room.startCountdownValue = 10;
    room.startCountdown = setInterval(async () => {
      room.startCountdownValue--;

      if (ioInstance) {
        ioInstance.to(PUBLIC_ROOM_CODE).emit('public:restart-countdown', room.startCountdownValue);
      }

      if (room.startCountdownValue <= 0) {
        clearInterval(room.startCountdown);
        room.startCountdown = null;
        await startPublicGame(room);
      }
    }, 1000);

    return;
  }

  // Si plus de joueurs, mettre en pause
  if (room.players.length === 0) {
    room.isPlaying = false;
    if (room.timer) {
      clearInterval(room.timer);
      room.timer = null;
    }
    console.log(`Room publique: mise en pause (plus de joueurs)`);
    return;
  }

  const currentTrack = room.tracks[room.currentTrackIndex];
  room.timeRemaining = currentTrack.timeLimit;

  if (ioInstance) {
    ioInstance.to(PUBLIC_ROOM_CODE).emit('game:next', {
      trackIndex: room.currentTrackIndex,
      trackId: currentTrack.id,
      imageFile: currentTrack.imageFile,
      timeLimit: currentTrack.timeLimit,
      startTime: currentTrack.startTime || 0,
      totalTracks: room.tracks.length,
      categoryId: currentTrack.categoryId,
    });
  }

  startTimerPublic(room);
}

app.prepare().then(async () => {
  // Créer la room publique au démarrage
  await createPublicRoom();

  // Charger le cache de tous les tracks pour vérification des suggestions
  allTracksCache = await loadTracks();
  console.log(`[CACHE] ${allTracksCache.length} tracks chargés en cache`);
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer);
  ioInstance = io; // Stocker pour les fonctions globales

  io.on('connection', (socket) => {
    console.log('Client connecté:', socket.id);

    let currentRoom = null;
    let currentPseudo = null;

    // Créer une room
    socket.on('room:create', async (pseudo, categories, maxRounds, callback) => {
      // Backward compatibility
      if (typeof maxRounds === 'function') {
        callback = maxRounds;
        maxRounds = null;
      }
      if (typeof categories === 'function') {
        callback = categories;
        categories = null;
        maxRounds = null;
      }

      // Vérifier que callback est une fonction
      if (typeof callback !== 'function') {
        console.error('room:create appelé sans callback valide');
        return;
      }

      try {
        let code = generateRoomCode();
        while (rooms.has(code)) {
          code = generateRoomCode();
        }

        // Charger et filtrer les tracks
        const allTracks = await loadTracks();
        const filteredTracks = filterTracksByCategories(allTracks, categories);

        if (filteredTracks.length === 0) {
          callback(null, 'Aucune musique disponible pour les catégories sélectionnées');
          return;
        }

        // Distribution équitable si maxRounds fourni
        let finalTracks = filteredTracks;
        if (maxRounds && maxRounds > 0) {
          // Grouper par catégorie
          const tracksPerCategory = {};
          for (const track of filteredTracks) {
            if (!tracksPerCategory[track.categoryId]) {
              tracksPerCategory[track.categoryId] = [];
            }
            tracksPerCategory[track.categoryId].push(track);
          }

          // Distribuer équitablement
          const activeCategories = categories && categories.length > 0
            ? categories
            : Object.keys(tracksPerCategory);

          finalTracks = distributeTracksEquitably(
            activeCategories,
            maxRounds,
            tracksPerCategory
          );
        } else {
          finalTracks = shuffleArray(filteredTracks);
        }

        const room = {
          code,
          players: [{ id: socket.id, pseudo, score: 0, hasFoundThisRound: false }],
          currentTrackIndex: 0,
          isPlaying: false,
          hostId: socket.id,
          tracks: finalTracks,
          categories: categories || [],
          maxRounds: maxRounds || null,
          timer: null,
          timeRemaining: 30,
          roundFinders: new Set(),
          deletionTimer: null,
          categoryStats: {}, // Stats par joueur: { playerId: { categoryId: count } }
        };

        rooms.set(code, room);
        socket.join(code);
        currentRoom = code;
        currentPseudo = pseudo;

        console.log(`Room ${code} créée par ${pseudo} avec ${finalTracks.length} tracks`);
        callback(code);
      } catch (error) {
        console.error('Erreur création room:', error);
        callback(null, 'Erreur serveur');
      }
    });

    // Rejoindre une room
    socket.on('room:join', (code, pseudo, callback) => {
      const roomCode = code.toUpperCase();
      const room = rooms.get(roomCode);

      if (!room) {
        callback(false, 'Room introuvable');
        return;
      }

      // If this socket is already registered in the room, don't add it again
      const existingById = room.players.find(p => p.id === socket.id);
      if (existingById) {
        socket.join(roomCode);
        currentRoom = roomCode;
        currentPseudo = existingById.pseudo;
        callback(true, null, existingById.pseudo);
        return;
      }

      // Vérifier si le pseudo existe déjà et ajouter un suffixe si nécessaire
      let finalPseudo = pseudo;
      const existingPseudos = room.players.map(p => p.pseudo.toLowerCase());
      if (existingPseudos.includes(pseudo.toLowerCase())) {
        let suffix = 2;
        while (existingPseudos.includes(`${pseudo.toLowerCase()}${suffix}`)) {
          suffix++;
        }
        finalPseudo = `${pseudo}${suffix}`;
      }

      const player = { id: socket.id, pseudo: finalPseudo, score: 0, hasFoundThisRound: false };
      room.players.push(player);
      socket.join(roomCode);
      currentRoom = roomCode;
      currentPseudo = finalPseudo;

      // If a deletion was scheduled because the room became temporarily empty, cancel it
      if (room.deletionTimer) {
        clearTimeout(room.deletionTimer);
        room.deletionTimer = null;
      }

      // Notifier les autres joueurs
      socket.to(currentRoom).emit('room:player-joined', player);

      // Logique spéciale pour la room publique
      if (room.isPublic) {
        // Si la partie n'est pas en cours et pas de countdown actif, démarrer le countdown
        if (!room.isPlaying && !room.startCountdown) {
          startPublicRoomCountdown(room);
        }
      }

      console.log(`${finalPseudo} a rejoint la room ${code}`);
      callback(true, null, finalPseudo);
    });

    // Obtenir l'état de la room
    socket.on('room:state', (callback) => {
      if (!currentRoom) {
        callback(null);
        return;
      }
      const room = rooms.get(currentRoom);
      if (!room) {
        callback(null);
        return;
      }

      const currentTrack = room.tracks[room.currentTrackIndex];
      callback({
        code: room.code,
        players: room.players,
        currentTrackIndex: room.currentTrackIndex,
        isPlaying: room.isPlaying,
        hostId: room.hostId,
        timeRemaining: room.timeRemaining,
        currentTrack: room.isPlaying && currentTrack ? {
          trackId: currentTrack.id,
          imageFile: currentTrack.imageFile,
          timeLimit: currentTrack.timeLimit,
          startTime: currentTrack.startTime || 0,
          categoryId: currentTrack.categoryId,
        } : null,
        totalTracks: room.tracks.length,
        categories: room.categories,
        isPublic: room.isPublic || false,
        startCountdownValue: room.startCountdownValue || null,
        isCountingDown: room.startCountdown !== null,
        roundFinders: Array.from(room.roundFinders || []),
      });
    });

    // Lancer la partie
    socket.on('game:start', async () => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room || room.hostId !== socket.id) return;

      try {
        // Recharger et refiltrer les tracks
        const allTracks = await loadTracks();
        const filteredTracks = filterTracksByCategories(allTracks, room.categories);

        // Respecter maxRounds si défini
        let finalTracks = filteredTracks;
        if (room.maxRounds && room.maxRounds > 0) {
          // Grouper par catégorie
          const tracksPerCategory = {};
          for (const track of filteredTracks) {
            if (!tracksPerCategory[track.categoryId]) {
              tracksPerCategory[track.categoryId] = [];
            }
            tracksPerCategory[track.categoryId].push(track);
          }

          // Distribuer équitablement
          const activeCategories = room.categories && room.categories.length > 0
            ? room.categories
            : Object.keys(tracksPerCategory);

          finalTracks = distributeTracksEquitably(
            activeCategories,
            room.maxRounds,
            tracksPerCategory
          );
        } else {
          finalTracks = shuffleArray(filteredTracks);
        }

        room.tracks = finalTracks;
        room.isPlaying = true;
        room.currentTrackIndex = 0;
        room.roundFinders = new Set();
        room.categoryStats = {}; // Reset stats de catégories

        // Reset scores et états
        room.players.forEach(p => {
          p.score = 0;
          p.hasFoundThisRound = false;
        });

        const currentTrack = room.tracks[room.currentTrackIndex];
        room.timeRemaining = currentTrack.timeLimit;

        io.to(currentRoom).emit('game:start', {
          trackIndex: room.currentTrackIndex,
          trackId: currentTrack.id,
          imageFile: currentTrack.imageFile,
          timeLimit: currentTrack.timeLimit,
          startTime: currentTrack.startTime || 0,
          totalTracks: room.tracks.length,
          categoryId: currentTrack.categoryId,
        });

        // Démarrer le timer
        startTimer(room, currentRoom, io);

        console.log(`Partie lancée dans la room ${currentRoom} avec ${room.tracks.length} tracks`);
      } catch (error) {
        console.error('Erreur lancement partie:', error);
      }
    });

    // Soumettre une réponse (style Skribbl.io)
    socket.on('game:answer', (answer) => {
      if (!currentRoom || !currentPseudo) return;
      const room = rooms.get(currentRoom);
      if (!room || !room.isPlaying) return;

      // Vérifier si ce joueur a déjà trouvé ce round
      const alreadyFound = room.roundFinders.has(socket.id);

      const currentTrack = room.tracks[room.currentTrackIndex];

      // Vérifier si la réponse vient d'une suggestion (titre VO ou VF exact)
      const isFromSuggestion = isAnswerFromSuggestion(answer, currentTrack.categoryId);

      console.log(`[ANSWER] ${currentPseudo}: "${answer}" (fromSuggestion: ${isFromSuggestion})`);

      // Ne pas valider les réponses si le temps est écoulé (mais permettre le chat)
      const canAnswer = room.timeRemaining > 0;
      // Ne pas vérifier si déjà trouvé OU si le temps est écoulé
      const isCorrect = canAnswer && !alreadyFound && checkAnswer(answer, currentTrack.acceptedAnswers);

      // Vérifier si la réponse est proche (à 2 caractères près) - seulement si le temps est encore actif
      let isClose = false;
      if (canAnswer && !isCorrect && !alreadyFound) {
        const normalizedInput = normalizeAnswer(answer);
        for (const acceptedAnswer of currentTrack.acceptedAnswers) {
          const normalizedAccepted = normalizeAnswer(acceptedAnswer);
          const distance = levenshteinDistance(normalizedInput, normalizedAccepted);
          if (distance <= 2 && distance > 0) {
            isClose = true;
            break;
          }
        }
      }

      // Si proche mais pas exact, envoyer un message privé
      if (isClose) {
        socket.emit('chat:hint', {
          message: '🔥 Vous êtes proche !',
        });
      }

      // Créer le message
      const chatMessage = {
        pseudo: currentPseudo,
        message: answer,
        isCorrect,
        playerId: socket.id,
        isFromFinder: alreadyFound,
      };

      // ROUTING DES MESSAGES
      if (isCorrect) {
        // Bonne réponse : ne pas afficher le texte, juste "a trouvé!"
        const foundMessage = {
          pseudo: currentPseudo,
          message: 'a trouvé!',
          isCorrect: true,
          playerId: socket.id,
          isFromFinder: false,
        };
        // Envoyer à tout le monde
        io.to(currentRoom).emit('chat:message', foundMessage);
      } else {
        // Mauvaise réponse depuis suggestion : perdre une vie
        if (isFromSuggestion && canAnswer && !alreadyFound) {
          console.log(`[LIVES] ${currentPseudo} perd une vie (mauvaise réponse depuis suggestion)`);
          socket.emit('game:wrong-answer');
        }

        // Tous les autres messages (mauvaises réponses, messages après avoir trouvé) : envoyer à tout le monde
        io.to(currentRoom).emit('chat:message', chatMessage);
      }

      if (isCorrect) {
        // Calculer le score basé sur le temps restant
        const isFirstFinder = room.roundFinders.size === 0;
        const scoreEarned = calculateScore(room.timeRemaining, currentTrack.timeLimit, isFirstFinder);

        // Ajouter le joueur aux finders
        room.roundFinders.add(socket.id);

        // Mettre à jour le score du joueur
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
          player.score += scoreEarned;
          player.hasFoundThisRound = true;
        }

        // Tracker les stats par catégorie
        if (!room.categoryStats[socket.id]) {
          room.categoryStats[socket.id] = {};
        }
        const categoryId = currentTrack.categoryId;
        room.categoryStats[socket.id][categoryId] = (room.categoryStats[socket.id][categoryId] || 0) + 1;

        // Notification privée au joueur qui a trouvé
        socket.emit('game:you-found', {
          scoreEarned,
          timeRemaining: room.timeRemaining,
          isFirst: isFirstFinder,
        });

        // Notification publique à tous (sans révéler la réponse)
        io.to(currentRoom).emit('game:player-found', {
          playerId: socket.id,
          pseudo: currentPseudo,
          players: room.players,
          findersCount: room.roundFinders.size,
          totalPlayers: room.players.length,
        });

        // Si tout le monde a trouvé, passer à la musique suivante
        if (room.roundFinders.size >= room.players.length) {
          // Arrêter le timer
          if (room.timer) {
            clearInterval(room.timer);
            room.timer = null;
          }

          // Émettre game:round-end immédiatement
          const finders = Array.from(room.roundFinders).map(id => {
            const p = room.players.find(player => player.id === id);
            return p ? { id, pseudo: p.pseudo } : null;
          }).filter(Boolean);

          io.to(currentRoom).emit('game:round-end', {
            trackId: currentTrack.id,
            title: currentTrack.title,
            titleVF: currentTrack.titleVF,
            imageFile: currentTrack.imageFile,
            finders,
            players: room.players,
            totalFound: room.roundFinders.size,
          });

          // Passer au suivant après 3 secondes
          if (room.isPublic) {
            setTimeout(() => nextTrackPublic(room), 3000);
          } else {
            setTimeout(() => nextTrack(room, currentRoom, io), 3000);
          }
        }
      }
    });

    // Quitter la room volontairement
    socket.on('room:leave', () => {
      if (currentRoom) {
        const room = rooms.get(currentRoom);
        if (room) {
          room.players = room.players.filter(p => p.id !== socket.id);
          socket.leave(currentRoom);

          if (room.players.length === 0) {
            if (room.timer) clearInterval(room.timer);

            // Room publique: ne pas supprimer, juste mettre en pause
            if (room.isPublic) {
              room.isPlaying = false;
              stopPublicRoomCountdown(room);
              console.log(`Room publique: mise en pause (plus de joueurs)`);
            } else {
              // Schedule deletion after a short grace period to allow reconnections
              room.deletionTimer = setTimeout(() => {
                const r = rooms.get(currentRoom);
                if (r && r.players.length === 0) {
                  if (r.timer) clearInterval(r.timer);
                  rooms.delete(currentRoom);
                  console.log(`Room ${currentRoom} supprimée (vide)`);
                }
              }, 10000);

              console.log(`Room ${currentRoom} will be deleted in 10s (empty)`);
            }
          } else {
            io.to(currentRoom).emit('room:player-left', socket.id);

            // Pour les rooms non-publiques, gérer le host
            if (!room.isPublic) {
              if (room.hostId === socket.id || !room.players.some(p => p.id === room.hostId)) {
                room.hostId = room.players[0].id;
                io.to(currentRoom).emit('room:new-host', room.hostId);
                console.log(`Room ${currentRoom} host reassigned to ${room.hostId}`);
              }
            }
          }
        }
        currentRoom = null;
        currentPseudo = null;
      }
    });

    // Déconnexion
    socket.on('disconnect', () => {
      console.log('Client déconnecté:', socket.id);

      if (currentRoom) {
        const room = rooms.get(currentRoom);
        if (room) {
          room.players = room.players.filter(p => p.id !== socket.id);

          if (room.players.length === 0) {
            if (room.timer) clearInterval(room.timer);

            // Room publique: ne pas supprimer, juste mettre en pause
            if (room.isPublic) {
              room.isPlaying = false;
              stopPublicRoomCountdown(room);
              console.log(`Room publique: mise en pause (plus de joueurs)`);
            } else {
              // Supprimer la room si vide, avec délai pour permettre une reconnexion
              room.deletionTimer = setTimeout(() => {
                const r = rooms.get(currentRoom);
                if (r && r.players.length === 0) {
                  if (r.timer) clearInterval(r.timer);
                  rooms.delete(currentRoom);
                  console.log(`Room ${currentRoom} supprimée (vide)`);
                }
              }, 10000);

              console.log(`Room ${currentRoom} will be deleted in 10s (empty)`);
            }
          } else {
            // Notifier les autres
            io.to(currentRoom).emit('room:player-left', socket.id);

            // Pour les rooms non-publiques, gérer le host
            if (!room.isPublic) {
              if (room.hostId === socket.id || !room.players.some(p => p.id === room.hostId)) {
                room.hostId = room.players[0].id;
                io.to(currentRoom).emit('room:new-host', room.hostId);
                console.log(`Room ${currentRoom} host reassigned to ${room.hostId}`);
              }
            }
          }
        }
      }
    });
  });

  // Démarrer le timer pour une room
  function startTimer(room, roomCode, io) {
    if (room.timer) clearInterval(room.timer);

    room.timer = setInterval(() => {
      room.timeRemaining--;

      io.to(roomCode).emit('game:tick', room.timeRemaining);

      if (room.timeRemaining <= 0) {
        clearInterval(room.timer);
        room.timer = null;

        // Fin du round - révéler la réponse à tous
        const currentTrack = room.tracks[room.currentTrackIndex];
        const finders = Array.from(room.roundFinders).map(id => {
          const p = room.players.find(player => player.id === id);
          return p ? { id, pseudo: p.pseudo } : null;
        }).filter(Boolean);

        io.to(roomCode).emit('game:round-end', {
          trackId: currentTrack.id,
          title: currentTrack.title,
          titleVF: currentTrack.titleVF,
          imageFile: currentTrack.imageFile,
          finders,
          players: room.players,
          totalFound: room.roundFinders.size,
        });

        // Passer au suivant après 3 secondes
        setTimeout(() => nextTrack(room, roomCode, io), 3000);
      }
    }, 1000);
  }

  // Passer au track suivant
  function nextTrack(room, roomCode, io) {
    room.currentTrackIndex++;
    room.roundFinders = new Set();
    room.players.forEach(p => p.hasFoundThisRound = false);

    if (room.currentTrackIndex >= room.tracks.length) {
      // Fin de partie
      room.isPlaying = false;
      io.to(roomCode).emit('game:end', {
        players: room.players.sort((a, b) => b.score - a.score),
        categoryStats: room.categoryStats,
      });
      return;
    }

    const currentTrack = room.tracks[room.currentTrackIndex];
    room.timeRemaining = currentTrack.timeLimit;

    io.to(roomCode).emit('game:next', {
      trackIndex: room.currentTrackIndex,
      trackId: currentTrack.id,
      imageFile: currentTrack.imageFile,
      timeLimit: currentTrack.timeLimit,
      startTime: currentTrack.startTime || 0,
      totalTracks: room.tracks.length,
      categoryId: currentTrack.categoryId,
    });

    startTimer(room, roomCode, io);
  }

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
