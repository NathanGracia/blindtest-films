require('dotenv').config({ path: '.env.local' });

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Charger les tracks
const tracksPath = path.join(__dirname, 'data', 'tracks.json');
const categoriesPath = path.join(__dirname, 'data', 'categories.json');

function loadTracks() {
  return JSON.parse(fs.readFileSync(tracksPath, 'utf-8'));
}

function loadCategories() {
  return JSON.parse(fs.readFileSync(categoriesPath, 'utf-8'));
}

// Stockage des rooms en mémoire
const rooms = new Map();

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

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer);

  io.on('connection', (socket) => {
    console.log('Client connecté:', socket.id);

    let currentRoom = null;
    let currentPseudo = null;

    // Créer une room
    socket.on('room:create', (pseudo, categories, callback) => {
      // Support de l'ancienne API (sans catégories)
      if (typeof categories === 'function') {
        callback = categories;
        categories = null;
      }

      let code = generateRoomCode();
      while (rooms.has(code)) {
        code = generateRoomCode();
      }

      // Charger et filtrer les tracks
      const allTracks = loadTracks();
      const filteredTracks = filterTracksByCategories(allTracks, categories);

      if (filteredTracks.length === 0) {
        callback(null, 'Aucune musique disponible pour les catégories sélectionnées');
        return;
      }

      const room = {
        code,
        players: [{ id: socket.id, pseudo, score: 0 }],
        currentTrackIndex: 0,
        isPlaying: false,
        hostId: socket.id,
        tracks: shuffleArray(filteredTracks),
        categories: categories || [],
        timer: null,
        timeRemaining: 30,
        roundFound: false,
        deletionTimer: null,
      };

      rooms.set(code, room);
      socket.join(code);
      currentRoom = code;
      currentPseudo = pseudo;

      console.log(`Room ${code} créée par ${pseudo} avec ${filteredTracks.length} tracks`);
      callback(code);
    });

    // Rejoindre une room
    socket.on('room:join', (code, pseudo, callback) => {
      const room = rooms.get(code.toUpperCase());

      if (!room) {
        callback(false, 'Room introuvable');
        return;
      }

      // If this socket is already registered in the room, don't add it again
      const existingById = room.players.find(p => p.id === socket.id);
      if (existingById) {
        socket.join(code.toUpperCase());
        currentRoom = code.toUpperCase();
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

      const player = { id: socket.id, pseudo: finalPseudo, score: 0 };
      room.players.push(player);
      socket.join(code.toUpperCase());
      currentRoom = code.toUpperCase();
      currentPseudo = finalPseudo;

      // If a deletion was scheduled because the room became temporarily empty, cancel it
      if (room.deletionTimer) {
        clearTimeout(room.deletionTimer);
        room.deletionTimer = null;
      }

      // Notifier les autres joueurs
      socket.to(currentRoom).emit('room:player-joined', player);

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
        } : null,
        totalTracks: room.tracks.length,
        categories: room.categories,
      });
    });

    // Lancer la partie
    socket.on('game:start', () => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room || room.hostId !== socket.id) return;

      // Recharger et refiltrer les tracks
      const allTracks = loadTracks();
      const filteredTracks = filterTracksByCategories(allTracks, room.categories);
      room.tracks = shuffleArray(filteredTracks);

      room.isPlaying = true;
      room.currentTrackIndex = 0;
      room.roundFound = false;

      // Reset scores
      room.players.forEach(p => p.score = 0);

      const currentTrack = room.tracks[room.currentTrackIndex];
      room.timeRemaining = currentTrack.timeLimit;

      io.to(currentRoom).emit('game:start', {
        trackIndex: room.currentTrackIndex,
        audioFile: currentTrack.audioFile,
        imageFile: currentTrack.imageFile,
        timeLimit: currentTrack.timeLimit,
        totalTracks: room.tracks.length,
      });

      // Démarrer le timer
      startTimer(room, currentRoom, io);

      console.log(`Partie lancée dans la room ${currentRoom}`);
    });

    // Soumettre une réponse
    socket.on('game:answer', (answer) => {
      if (!currentRoom || !currentPseudo) return;
      const room = rooms.get(currentRoom);
      if (!room || !room.isPlaying || room.roundFound) return;

      const currentTrack = room.tracks[room.currentTrackIndex];
      const isCorrect = checkAnswer(answer, currentTrack.acceptedAnswers);

      // Broadcast la tentative à tous
      io.to(currentRoom).emit('chat:message', {
        pseudo: currentPseudo,
        message: answer,
        isCorrect,
        playerId: socket.id,
      });

      if (isCorrect) {
        room.roundFound = true;

        // Incrémenter le score
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
          player.score++;
        }

        // Arrêter le timer
        if (room.timer) {
          clearInterval(room.timer);
          room.timer = null;
        }

        // Notifier tout le monde
        io.to(currentRoom).emit('game:correct-answer', {
          playerId: socket.id,
          pseudo: currentPseudo,
          title: currentTrack.title,
          imageFile: currentTrack.imageFile,
          players: room.players,
        });

        // Passer au track suivant après 3 secondes
        setTimeout(() => nextTrack(room, currentRoom, io), 3000);
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
          } else {
            io.to(currentRoom).emit('room:player-left', socket.id);

            // Ensure there is a valid host: if the leaving player was host or the host id
            // is no longer present in the players list, reassign to the first connected player
            // and notify clients.
            if (room.hostId === socket.id || !room.players.some(p => p.id === room.hostId)) {
              room.hostId = room.players[0].id;
              io.to(currentRoom).emit('room:new-host', room.hostId);
              console.log(`Room ${currentRoom} host reassigned to ${room.hostId}`);
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
            // Supprimer la room si vide, avec délai pour permettre une reconnexion
            if (room.timer) clearInterval(room.timer);

            room.deletionTimer = setTimeout(() => {
              const r = rooms.get(currentRoom);
              if (r && r.players.length === 0) {
                if (r.timer) clearInterval(r.timer);
                rooms.delete(currentRoom);
                console.log(`Room ${currentRoom} supprimée (vide)`);
              }
            }, 10000);

            console.log(`Room ${currentRoom} will be deleted in 10s (empty)`);
          } else {
            // Notifier les autres
            io.to(currentRoom).emit('room:player-left', socket.id);

            // Ensure there is a valid host: if the disconnecting player was host or the host id
            // is no longer present in the players list, reassign to the first connected player
            // and notify clients.
            if (room.hostId === socket.id || !room.players.some(p => p.id === room.hostId)) {
              room.hostId = room.players[0].id;
              io.to(currentRoom).emit('room:new-host', room.hostId);
              console.log(`Room ${currentRoom} host reassigned to ${room.hostId}`);
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

        if (!room.roundFound) {
          const currentTrack = room.tracks[room.currentTrackIndex];
          io.to(roomCode).emit('game:time-up', {
            title: currentTrack.title,
            imageFile: currentTrack.imageFile,
          });

          // Passer au suivant après 3 secondes
          setTimeout(() => nextTrack(room, roomCode, io), 3000);
        }
      }
    }, 1000);
  }

  // Passer au track suivant
  function nextTrack(room, roomCode, io) {
    room.currentTrackIndex++;
    room.roundFound = false;

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
      totalTracks: room.tracks.length,
    });

    startTimer(room, roomCode, io);
  }

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
