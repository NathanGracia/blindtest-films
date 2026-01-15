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

// Stockage des rooms en mémoire
const rooms = new Map();

// Créer la room publique permanente
async function createPublicRoom() {
  try {
    const allTracks = await loadTracks();
    const shuffled = shuffleArray(allTracks);
    const limitedTracks = shuffled.slice(0, 25); // Limiter à 25 œuvres
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
      startCountdownValue: 15,
    };
    rooms.set(PUBLIC_ROOM_CODE, publicRoom);
    console.log(`Room publique ${PUBLIC_ROOM_CODE} créée avec ${limitedTracks.length} tracks`);
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

  room.startCountdownValue = 30;
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
    room.startCountdownValue = 30;
    console.log(`Countdown room publique arrêté`);
  }
}

// Démarrer la partie de la room publique
async function startPublicGame(room) {
  if (!ioInstance) return;

  try {
    const allTracks = await loadTracks();
    const shuffled = shuffleArray(allTracks);
    room.tracks = shuffled.slice(0, 25); // Limiter à 25 œuvres
    room.currentTrackIndex = 0;
    room.isPlaying = true;
    room.roundFinders = new Set();

    // Reset scores et états des joueurs
    room.players.forEach(p => {
      p.score = 0;
      p.hasFoundThisRound = false;
    });

    const currentTrack = room.tracks[room.currentTrackIndex];
    room.timeRemaining = currentTrack.timeLimit;

    ioInstance.to(PUBLIC_ROOM_CODE).emit('game:start', {
      trackIndex: room.currentTrackIndex,
      audioFile: currentTrack.audioFile,
      imageFile: currentTrack.imageFile,
      timeLimit: currentTrack.timeLimit,
      startTime: currentTrack.startTime || 0,
      totalTracks: room.tracks.length,
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
function nextTrackPublic(room) {
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
    if (ioInstance) {
      ioInstance.to(PUBLIC_ROOM_CODE).emit('game:end', {
        players: room.players.sort((a, b) => b.score - a.score),
      });
    }
    console.log(`Room publique: partie terminée, ${room.players.length} joueurs`);

    // Lancer le countdown pour une nouvelle partie après 15 secondes
    room.startCountdownValue = 15;
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
      audioFile: currentTrack.audioFile,
      imageFile: currentTrack.imageFile,
      timeLimit: currentTrack.timeLimit,
      startTime: currentTrack.startTime || 0,
      totalTracks: room.tracks.length,
    });
  }

  startTimerPublic(room);
}

app.prepare().then(async () => {
  // Créer la room publique au démarrage
  await createPublicRoom();
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
    socket.on('room:create', async (pseudo, categories, callback) => {
      // Support de l'ancienne API (sans catégories)
      if (typeof categories === 'function') {
        callback = categories;
        categories = null;
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

        const room = {
          code,
          players: [{ id: socket.id, pseudo, score: 0, hasFoundThisRound: false }],
          currentTrackIndex: 0,
          isPlaying: false,
          hostId: socket.id,
          tracks: shuffleArray(filteredTracks),
          categories: categories || [],
          timer: null,
          timeRemaining: 30,
          roundFinders: new Set(),
          deletionTimer: null,
        };

        rooms.set(code, room);
        socket.join(code);
        currentRoom = code;
        currentPseudo = pseudo;

        console.log(`Room ${code} créée par ${pseudo} avec ${filteredTracks.length} tracks`);
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
          audioFile: currentTrack.audioFile,
          imageFile: currentTrack.imageFile,
          timeLimit: currentTrack.timeLimit,
          startTime: currentTrack.startTime || 0,
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
        room.tracks = shuffleArray(filteredTracks);

        room.isPlaying = true;
        room.currentTrackIndex = 0;
        room.roundFinders = new Set();

        // Reset scores et états
        room.players.forEach(p => {
          p.score = 0;
          p.hasFoundThisRound = false;
        });

        const currentTrack = room.tracks[room.currentTrackIndex];
        room.timeRemaining = currentTrack.timeLimit;

        io.to(currentRoom).emit('game:start', {
          trackIndex: room.currentTrackIndex,
          audioFile: currentTrack.audioFile,
          imageFile: currentTrack.imageFile,
          timeLimit: currentTrack.timeLimit,
          startTime: currentTrack.startTime || 0,
          totalTracks: room.tracks.length,
        });

        // Démarrer le timer
        startTimer(room, currentRoom, io);

        console.log(`Partie lancée dans la room ${currentRoom}`);
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
      // Ne pas vérifier si déjà trouvé
      const isCorrect = !alreadyFound && checkAnswer(answer, currentTrack.acceptedAnswers);

      // Vérifier si la réponse est proche (à 2 caractères près)
      let isClose = false;
      if (!isCorrect && !alreadyFound) {
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

      // ROUTING SÉLECTIF DES MESSAGES
      if (alreadyFound) {
        // Joueur qui a déjà trouvé : envoyer uniquement aux autres qui ont trouvé
        room.roundFinders.forEach(finderId => {
          io.to(finderId).emit('chat:message', chatMessage);
        });
      } else if (isCorrect) {
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
        // Mauvaise réponse : envoyer à tout le monde (gagnants et non-gagnants)
        // Les gagnants peuvent ainsi voir les tentatives des autres pour les aider
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
      });
      return;
    }

    const currentTrack = room.tracks[room.currentTrackIndex];
    room.timeRemaining = currentTrack.timeLimit;

    io.to(roomCode).emit('game:next', {
      trackIndex: room.currentTrackIndex,
      audioFile: currentTrack.audioFile,
      imageFile: currentTrack.imageFile,
      timeLimit: currentTrack.timeLimit,
      startTime: currentTrack.startTime || 0,
      totalTracks: room.tracks.length,
    });

    startTimer(room, roomCode, io);
  }

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
