require('dotenv').config();

const { createServer } = require('http');
const { parse } = require('url');
const path = require('path');
const fs = require('fs');
const next = require('next');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3001;

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

// Sauvegarder un GameResult pour un joueur avec compte
async function saveGameResult({ userId, score, rank, totalPlayers, tracksFound, totalTracks, categories, roomCode }) {
  if (!userId) return;
  try {
    await prisma.gameResult.create({
      data: {
        userId,
        score,
        rank,
        totalPlayers,
        tracksFound,
        totalTracks,
        categories: JSON.stringify(categories),
        roomCode,
      },
    });
  } catch (err) {
    console.error('[GAME_RESULT] Erreur sauvegarde:', err);
  }
}

// Définitions des succès (dupliquées ici pour eviter import ESM)
const ACHIEVEMENT_DEFS = {
  first_game:    { name: 'Première partie',   description: 'Jouer sa première partie',                          icon: '🎮' },
  first_correct: { name: 'Premier sang',      description: 'Trouver sa première bonne réponse',                 icon: '🎯' },
  emote_used:    { name: 'Expressif',         description: 'Utiliser une emote dans le chat',                   icon: '🎭' },
  champion:      { name: 'Champion',          description: 'Finir 1er avec au moins 2 joueurs',                 icon: '🏆' },
  perfect:       { name: 'Sans faute',        description: 'Trouver toutes les tracks d\'une partie',           icon: '💯' },
  speed_demon:   { name: 'Éclair',            description: 'Trouver une réponse dans les 3 premières secondes', icon: '⚡' },
  habitue:       { name: 'Habitué',           description: 'Jouer 100 parties',                                 icon: '📅' },
  veteran:       { name: 'Vétéran',           description: 'Jouer 1000 parties',                                icon: '🎖️' },
  hat_trick:     { name: 'Hat-trick',         description: 'Finir 1er 3 fois de suite',                         icon: '🔥' },
  night_owl:     { name: 'Oiseau de nuit',    description: 'Jouer entre minuit et 6h du matin',                 icon: '🦉' },
  lucky:         { name: 'Chanceux',          description: 'Trouver une réponse après avoir perdu 2 vies',      icon: '🍀' },
  chatty:        { name: 'Bavard',            description: 'Envoyer 30 messages dans le chat en une partie',    icon: '💬' },
};

async function sanitizeEmotes(message, userId) {
  const emotePattern = /:([a-zA-Z0-9_]+):/g;
  if (!emotePattern.test(message)) return message;
  emotePattern.lastIndex = 0;

  const lockedEmotes = await prisma.emote.findMany({
    where: { achievementCode: { not: null } },
    select: { code: true, achievementCode: true },
  });
  if (lockedEmotes.length === 0) return message;

  const lockedMap = new Map(lockedEmotes.map(e => [e.code, e.achievementCode]));

  let unlockedAchievements = new Set();
  if (userId) {
    const achievements = await prisma.userAchievement.findMany({
      where: { userId },
      select: { code: true },
    });
    unlockedAchievements = new Set(achievements.map(a => a.code));
  }

  return message.replace(/:([a-zA-Z0-9_]+):/g, (match, code) => {
    const required = lockedMap.get(code);
    if (!required) return match; // emote libre
    if (unlockedAchievements.has(required)) return match; // débloquée
    return code; // pas débloquée : on retire les ':'
  });
}

async function unlockAchievement(player, code, io, roomCode = null) {
  if (!player.userId) return false;
  try {
    const existing = await prisma.userAchievement.findUnique({
      where: { userId_code: { userId: player.userId, code } },
    });
    if (existing) return false;
    await prisma.userAchievement.create({ data: { userId: player.userId, code } });
    console.log(`[ACHIEVEMENT] ${player.pseudo}: ${code}`);
    if (io && player.id && ACHIEVEMENT_DEFS[code]) {
      const def = ACHIEVEMENT_DEFS[code];
      const linkedEmote = await prisma.emote.findFirst({ where: { achievementCode: code }, select: { imageFile: true } });
      const imageFile = linkedEmote?.imageFile || null;
      // Notif privée au joueur
      io.to(player.id).emit('achievement:unlocked', { code, name: def.name, description: def.description, icon: def.icon, imageFile });
      // Broadcast dans la salle
      if (roomCode) {
        io.to(roomCode).emit('chat:message', {
          pseudo: player.pseudo,
          message: def.name,
          isCorrect: false,
          playerId: player.id,
          isAchievement: true,
          achievementIcon: def.icon,
          achievementImageFile: imageFile,
          avatarFile: player.avatarFile || null,
          username: player.username || null,
        });
      }
    }
    return true;
  } catch (err) {
    console.error('[ACHIEVEMENT] Erreur:', err);
    return false;
  }
}

async function checkAndUnlockAchievements(player, { rank, totalPlayers, tracksFound, totalTracks }, io, roomCode = null) {
  if (!player.userId) return;
  try {
    const existing = await prisma.userAchievement.findMany({
      where: { userId: player.userId },
      select: { code: true },
    });
    const have = new Set(existing.map(a => a.code));
    const toUnlock = [];

    if (!have.has('first_game')) toUnlock.push('first_game');
    if (!have.has('champion') && rank === 1 && totalPlayers >= 2) toUnlock.push('champion');
    if (!have.has('perfect') && tracksFound === totalTracks && totalTracks > 0) toUnlock.push('perfect');

    // Night owl : jouer entre minuit et 6h
    if (!have.has('night_owl')) {
      const hour = new Date().getHours();
      if (hour >= 0 && hour < 6) toUnlock.push('night_owl');
    }

    // Veteran / Habitué : compter les parties jouées
    if (!have.has('veteran') || !have.has('habitue')) {
      const gamesPlayed = await prisma.gameResult.count({ where: { userId: player.userId } });
      if (!have.has('habitue') && gamesPlayed >= 100) toUnlock.push('habitue');
      if (!have.has('veteran') && gamesPlayed >= 1000) toUnlock.push('veteran');
    }

    // Hat-trick : finir 1er 3 fois de suite (avec 2+ joueurs)
    if (!have.has('hat_trick') && rank === 1 && totalPlayers >= 2) {
      const last3 = await prisma.gameResult.findMany({
        where: { userId: player.userId },
        orderBy: { playedAt: 'desc' },
        take: 3,
        select: { rank: true },
      });
      if (last3.length === 3 && last3.every(r => r.rank === 1)) toUnlock.push('hat_trick');
    }

    if (toUnlock.length === 0) return;

    for (const code of toUnlock) {
      await unlockAchievement(player, code, io, roomCode);
    }
  } catch (err) {
    console.error('[ACHIEVEMENT] Erreur:', err);
  }
}

// Sauvegarder le score dans le ladder (upsert)
async function saveLadderScore(pseudo, score) {
  if (!pseudo || score <= 0) return;

  const normalizedPseudo = pseudo.trim().toLowerCase();
  const weekId = 'all-time';

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
async function loadTracks({ rankedOnly = false } = {}) {
  const where = rankedOnly
    ? { category: { rankedEnabled: true } }
    : {};
  const tracks = await prisma.track.findMany({ where });
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
    const allTracks = await loadTracks({ rankedOnly: true });

    // Distribution avec répartition par difficulté
    const limitedTracks = distributeTracksWithDifficulty(allTracks, 25);

    const publicRoom = {
      code: PUBLIC_ROOM_CODE,
      players: [],
      currentTrackIndex: 0,
      isPlaying: false,
      hostId: null, // Pas de host pour la room publique
      tracks: limitedTracks,
      categories: [...new Set(limitedTracks.map(t => t.categoryId))],
      timer: null,
      timeRemaining: 30,
      roundFinders: new Set(), // Joueurs qui ont trouvé ce round
      playerMisses: {},        // { [socketId]: number } — mauvaises réponses depuis suggestion ce round
      playerChatCount: {},     // { [socketId]: number } — messages chat cette partie
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

// Determinoss : seed depuis la lampe à lave
let currentRNG = Math.random;

function seededRNG(hexSeed) {
  let seed = parseInt(hexSeed.slice(0, 8), 16);
  return () => {
    seed += 0x6D2B79F5;
    let t = seed;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

async function refreshDeternossSeed() {
  try {
    const token = fs.readFileSync(path.join(__dirname, 'token.txt'), 'utf8').trim();
    const res = await fetch(`https://determinoss.nathangracia.com/seed?token=${encodeURIComponent(token)}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.seed) {
      currentRNG = seededRNG(data.seed);
      console.log(`[DETERMINOSS] Seed refreshed: ${data.seed.slice(0, 8)}... (age: ${data.age_ms}ms)`);
    }
  } catch (err) {
    console.warn('[DETERMINOSS] Failed to fetch seed, using Math.random:', err.message);
  }
}

// Mélanger un tableau (utilise le RNG seedé par la lampe à lave si disponible)
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(currentRNG() * (i + 1));
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

// Distribuer les tracks avec répartition par difficulté (40% easy, 40% medium, 20% hard)
function distributeTracksWithDifficulty(allTracks, totalRounds) {
  const DIFFICULTY_RATIOS = { easy: 0.40, medium: 0.40, hard: 0.20 };

  // Séparer par difficulté
  const buckets = { easy: [], medium: [], hard: [], untagged: [] };
  for (const track of allTracks) {
    const key = track.difficulty || 'untagged';
    buckets[key].push(track);
  }

  // Catégories disponibles (pour l'équité inter-catégories)
  const allCategories = [...new Set(allTracks.map(t => t.categoryId))];

  function groupByCategory(tracks) {
    const map = {};
    for (const track of tracks) {
      if (!map[track.categoryId]) map[track.categoryId] = [];
      map[track.categoryId].push(track);
    }
    return map;
  }

  const result = [];
  let untaggedPool = shuffleArray([...buckets.untagged]);

  for (const [difficulty, ratio] of Object.entries(DIFFICULTY_RATIOS)) {
    const target = Math.round(totalRounds * ratio);
    const available = buckets[difficulty];

    // Distribuer équitablement dans ce bucket
    const perCategory = groupByCategory(available);
    const cats = allCategories.filter(c => perCategory[c]?.length > 0);

    let selected = cats.length > 0
      ? distributeTracksEquitably(cats, Math.min(target, available.length), perCategory)
      : [];

    // Fallback : combler le manque avec les untagged
    const shortfall = target - selected.length;
    if (shortfall > 0 && untaggedPool.length > 0) {
      const untaggedPerCat = groupByCategory(untaggedPool);
      const untaggedCats = allCategories.filter(c => untaggedPerCat[c]?.length > 0);
      const extra = untaggedCats.length > 0
        ? distributeTracksEquitably(untaggedCats, Math.min(shortfall, untaggedPool.length), untaggedPerCat)
        : [];

      selected.push(...extra);
      const usedIds = new Set(extra.map(t => t.id));
      untaggedPool = untaggedPool.filter(t => !usedIds.has(t.id));
    }

    result.push(...selected);
  }

  // Compléter si on est encore en dessous du total
  const usedIds = new Set(result.map(t => t.id));
  if (result.length < totalRounds) {
    const remaining = allTracks.filter(t => !usedIds.has(t.id));
    const perCat = groupByCategory(remaining);
    const cats = [...new Set(remaining.map(t => t.categoryId))];
    const extra = distributeTracksEquitably(cats, totalRounds - result.length, perCat);
    result.push(...extra);
  }

  console.log('[DIFFICULTY]', result.reduce((acc, t) => {
    acc[t.difficulty || 'untagged'] = (acc[t.difficulty || 'untagged'] || 0) + 1;
    return acc;
  }, {}));

  return shuffleArray(result);
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
    const allTracks = await loadTracks({ rankedOnly: true });

    // Distribution avec répartition par difficulté
    room.tracks = distributeTracksWithDifficulty(allTracks, 25);
    room.currentTrackIndex = 0;
    room.isPlaying = true;
    room.roundFinders = new Set();
    room.playerMisses = {};
    room.playerChatCount = {};
    room.categoryStats = {}; // Reset stats de catégories

    // Reset scores et états des joueurs
    room.players.forEach(p => {
      p.score = 0;
      p.hasFoundThisRound = false;
      p.tracksFound = 0;
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
      difficulty: currentTrack.difficulty || null,
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
  room.playerMisses = {};
  room.players.forEach(p => p.hasFoundThisRound = false);

  // Si fin des tracks (25 œuvres), fin de partie
  if (room.currentTrackIndex >= room.tracks.length) {
    room.isPlaying = false;
    if (room.timer) {
      clearInterval(room.timer);
      room.timer = null;
    }

    // Sauvegarder les scores dans le ladder + GameResult
    const sortedPlayers = room.players.sort((a, b) => b.score - a.score);
    const publicCategories = [...new Set(room.tracks.map(t => t.categoryId))];
    for (let i = 0; i < sortedPlayers.length; i++) {
      const player = sortedPlayers[i];
      if (player.score > 0) {
        await saveLadderScore(player.pseudo, player.score);
      }
      await saveGameResult({
        userId: player.userId || null,
        score: player.score,
        rank: i + 1,
        totalPlayers: sortedPlayers.length,
        tracksFound: player.tracksFound || 0,
        totalTracks: room.tracks.length,
        categories: publicCategories,
        roomCode: PUBLIC_ROOM_CODE,
      });
      if (ioInstance) {
        await checkAndUnlockAchievements(player, {
          rank: i + 1,
          totalPlayers: sortedPlayers.length,
          tracksFound: player.tracksFound || 0,
          totalTracks: room.tracks.length,
        }, ioInstance, PUBLIC_ROOM_CODE);
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
      difficulty: currentTrack.difficulty || null,
    });
  }

  startTimerPublic(room);
}

app.prepare().then(async () => {
  // Charger le seed Determinoss (lampe à lave) au démarrage
  await refreshDeternossSeed();
  setInterval(refreshDeternossSeed, 60_000);

  // Créer la room publique au démarrage
  await createPublicRoom();

  // Charger le cache de tous les tracks pour vérification des suggestions
  allTracksCache = await loadTracks();
  console.log(`[CACHE] ${allTracksCache.length} tracks chargés en cache`);

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);

    // Endpoint interne pour recharger le cache
    if (req.url === '/internal/reload-cache' && req.method === 'POST') {
      loadTracks().then(tracks => {
        allTracksCache = tracks;
        console.log(`[CACHE] Cache rechargé: ${allTracksCache.length} tracks`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          tracksCount: allTracksCache.length,
        }));
      }).catch(err => {
        console.error('[CACHE] Erreur rechargement:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to reload cache' }));
      });
      return;
    }

    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer);
  ioInstance = io; // Stocker pour les fonctions globales

  io.on('connection', (socket) => {
    console.log('Client connecté:', socket.id);

    let currentRoom = null;
    let currentPseudo = null;
    let currentUserId = null; // null = guest

    // Vérifier le token (synchrone) et lancer la DB en parallèle (sans bloquer)
    const rawCookie = socket.handshake.headers.cookie || '';
    const match = rawCookie.match(/blindtoss_user_session=([^;]+)/);
    let displayNamePromise = Promise.resolve({ username: null, displayName: null, avatarFile: null });

    if (match) {
      try {
        const token = decodeURIComponent(match[1]);
        const parts = token.split(':');
        if (parts.length === 3) {
          const [userIdStr, expiresAtStr, hmac] = parts;
          const expiresAt = parseInt(expiresAtStr, 10);
          if (Date.now() < expiresAt) {
            const crypto = require('crypto');
            const secret = process.env.ADMIN_PASSWORD || 'blindtoss-user-secret';
            const expected = crypto.createHmac('sha256', secret)
              .update(`${userIdStr}:${expiresAtStr}`)
              .digest('hex');
            if (hmac === expected) {
              currentUserId = parseInt(userIdStr, 10);
              // Charger displayName + avatarFile en parallèle — les handlers s'enregistrent immédiatement
              displayNamePromise = prisma.user.findUnique({
                where: { id: currentUserId },
                select: { username: true, displayName: true, avatarFile: true },
              }).then(u => ({ username: u?.username || null, displayName: u?.displayName || null, avatarFile: u?.avatarFile || null })).catch(() => ({ username: null, displayName: null, avatarFile: null }));
            }
          }
        }
      } catch { /* token invalide, reste guest */ }
    }

    // Créer une room
    socket.on('room:create', async (pseudo, categories, maxRounds, difficulty, callback) => {
      // Backward compatibility
      if (typeof difficulty === 'function') {
        callback = difficulty;
        difficulty = null;
      }
      if (typeof maxRounds === 'function') {
        callback = maxRounds;
        maxRounds = null;
        difficulty = null;
      }
      if (typeof categories === 'function') {
        callback = categories;
        categories = null;
        maxRounds = null;
        difficulty = null;
      }

      // Vérifier que callback est une fonction
      if (typeof callback !== 'function') {
        console.error('room:create appelé sans callback valide');
        return;
      }

      try {
        // Bloquer les guests qui usurpent le pseudo d'un compte existant
        if (!currentUserId) {
          const taken = await prisma.user.findUnique({
            where: { username: pseudo.trim().toLowerCase() },
            select: { id: true },
          });
          if (taken) {
            callback(null, 'Ce pseudo appartient à un compte enregistré. Connectez-vous ou choisissez un autre pseudo.');
            return;
          }
        }

        let code = generateRoomCode();
        while (rooms.has(code)) {
          code = generateRoomCode();
        }

        // Charger et filtrer les tracks par catégorie puis par difficulté
        const allTracks = await loadTracks();
        let filteredTracks = filterTracksByCategories(allTracks, categories);
        if (difficulty) {
          filteredTracks = filteredTracks.filter(t => t.difficulty === difficulty);
        }

        if (filteredTracks.length === 0) {
          callback(null, 'Aucune musique disponible pour les catégories et la difficulté sélectionnées');
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

        const { username: userUsername, displayName: userDisplayName, avatarFile: userAvatarFile } = await displayNamePromise;
        const effectivePseudo = userDisplayName || pseudo;
        const room = {
          code,
          players: [{ id: socket.id, pseudo: effectivePseudo, score: 0, hasFoundThisRound: false, userId: currentUserId, avatarFile: userAvatarFile, username: userUsername }],
          currentTrackIndex: 0,
          isPlaying: false,
          hostId: socket.id,
          tracks: finalTracks,
          categories: categories || [],
          maxRounds: maxRounds || null,
          difficulty: difficulty || null,
          timer: null,
          timeRemaining: 30,
          roundFinders: new Set(),
          playerMisses: {},
          playerChatCount: {},
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
    socket.on('room:join', async (code, pseudo, callback) => {
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

      // Utiliser le displayName si le joueur est connecté
      const { username: userUsername, displayName: userDisplayName, avatarFile: userAvatarFile } = await displayNamePromise;
      const requestedPseudo = userDisplayName || pseudo;

      // Bloquer les guests qui usurpent le pseudo d'un compte existant
      if (!currentUserId) {
        const taken = await prisma.user.findUnique({
          where: { username: pseudo.trim().toLowerCase() },
          select: { id: true },
        });
        if (taken) {
          callback(false, 'Ce pseudo appartient à un compte enregistré. Connectez-vous ou choisissez un autre pseudo.');
          return;
        }
      }

      // Vérifier si le pseudo existe déjà et ajouter un suffixe si nécessaire
      let finalPseudo = requestedPseudo;
      const existingPseudos = room.players.map(p => p.pseudo.toLowerCase());
      if (existingPseudos.includes(requestedPseudo.toLowerCase())) {
        let suffix = 2;
        while (existingPseudos.includes(`${requestedPseudo.toLowerCase()}${suffix}`)) {
          suffix++;
        }
        finalPseudo = `${requestedPseudo}${suffix}`;
      }

      const player = { id: socket.id, pseudo: finalPseudo, score: 0, hasFoundThisRound: false, userId: currentUserId, avatarFile: userAvatarFile, username: userUsername };
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
        let filteredTracks = filterTracksByCategories(allTracks, room.categories);
        if (room.difficulty) {
          filteredTracks = filteredTracks.filter(t => t.difficulty === room.difficulty);
        }

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
        room.playerMisses = {};
        room.playerChatCount = {};
        room.categoryStats = {}; // Reset stats de catégories

        // Reset scores et états
        room.players.forEach(p => {
          p.score = 0;
          p.hasFoundThisRound = false;
          p.tracksFound = 0;
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
          difficulty: currentTrack.difficulty || null,
        });

        // Démarrer le timer
        startTimer(room, currentRoom, io);

        console.log(`Partie lancée dans la room ${currentRoom} avec ${room.tracks.length} tracks`);
      } catch (error) {
        console.error('Erreur lancement partie:', error);
      }
    });

    // Soumettre une réponse (style Skribbl.io)
    socket.on('game:answer', async (answer) => {
      if (!currentRoom || !currentPseudo) return;
      const room = rooms.get(currentRoom);
      if (!room || !room.isPlaying) return;

      // Vérifier si ce joueur a déjà trouvé ce round
      const alreadyFound = room.roundFinders.has(socket.id);

      const currentTrack = room.tracks[room.currentTrackIndex];

      // Vérifier si la réponse vient d'une suggestion (titre VO ou VF exact)
      const isFromSuggestion = isAnswerFromSuggestion(answer, currentTrack.categoryId);


      // Ne pas valider les réponses si le temps est écoulé (mais permettre le chat)
      const canAnswer = room.timeRemaining > 0;
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
      const currentPlayer = room.players.find(p => p.id === socket.id);
      const currentAvatarFile = currentPlayer?.avatarFile || null;
      const currentUsername = currentPlayer?.username || null;
      const sanitizedAnswer = await sanitizeEmotes(answer, currentPlayer?.userId || null);
      const chatMessage = {
        pseudo: currentPseudo,
        message: sanitizedAnswer,
        isCorrect,
        playerId: socket.id,
        isFromFinder: alreadyFound,
        avatarFile: currentAvatarFile,
        username: currentUsername,
      };

      // Détecter réponse éclair (moins de 3 secondes)
      const isLightning = isCorrect && currentTrack && room.timeRemaining >= currentTrack.timeLimit - 3;

      // ROUTING DES MESSAGES
      if (isCorrect) {
        // Pré-calculer le score pour l'afficher dans le message
        const isFirstFinderPreview = room.roundFinders.size === 0;
        const LIGHTNING_BONUS_PREVIEW = 100;
        let scorePreview = calculateScore(room.timeRemaining, currentTrack.timeLimit, isFirstFinderPreview);
        if (isLightning) scorePreview += LIGHTNING_BONUS_PREVIEW;

        // Bonne réponse : ne pas afficher le texte, juste "a trouvé!"
        const foundMessage = {
          pseudo: currentPseudo,
          message: isLightning ? `a trouvé en ${currentTrack.timeLimit - room.timeRemaining}s ! (+${scorePreview})` : `a trouvé ! (+${scorePreview})`,
          isCorrect: true,
          isLightning,
          playerId: socket.id,
          isFromFinder: false,
          avatarFile: currentAvatarFile,
          username: currentUsername,
        };
        // Envoyer à tout le monde
        io.to(currentRoom).emit('chat:message', foundMessage);
      } else {
        // Mauvaise réponse depuis suggestion : perdre une vie
        if (isFromSuggestion && canAnswer && !alreadyFound) {
          console.log(`[LIVES] ${currentPseudo} perd une vie (mauvaise réponse depuis suggestion)`);
          socket.emit('game:wrong-answer');
          // Tracker les misses pour le succès "lucky"
          room.playerMisses[socket.id] = (room.playerMisses[socket.id] || 0) + 1;
        }

        // Tous les autres messages (mauvaises réponses, messages après avoir trouvé) : envoyer à tout le monde
        io.to(currentRoom).emit('chat:message', chatMessage);

        // Succès emote_used
        if (/:([a-zA-Z0-9_]+):/.test(answer) && currentPlayer) {
          unlockAchievement(currentPlayer, 'emote_used', io, currentRoom);
        }

        // Succès chatty : compteur cumulatif global
        if (currentPlayer?.userId) {
          prisma.user.update({
            where: { id: currentPlayer.userId },
            data: { totalChatMessages: { increment: 1 } },
          }).then(updated => {
            if (updated.totalChatMessages >= 30) {
              unlockAchievement(currentPlayer, 'chatty', io, currentRoom);
            }
          }).catch(() => {});
        }
      }

      if (isCorrect) {
        // Calculer le score basé sur le temps restant
        const isFirstFinder = room.roundFinders.size === 0;
        const LIGHTNING_BONUS = 100;
        let scoreEarned = calculateScore(room.timeRemaining, currentTrack.timeLimit, isFirstFinder);
        if (isLightning) scoreEarned += LIGHTNING_BONUS;

        // Ajouter le joueur aux finders
        room.roundFinders.add(socket.id);

        // Mettre à jour le score du joueur
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
          player.score += scoreEarned;
          player.hasFoundThisRound = true;
          player.tracksFound = (player.tracksFound || 0) + 1;
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
          isLightning,
        });

        // Succès sur bonne réponse
        if (currentPlayer) {
          unlockAchievement(currentPlayer, 'first_correct', io, currentRoom);
          // Speed demon : réponse dans les 3 premières secondes
          if (room.timeRemaining >= currentTrack.timeLimit - 3) {
            unlockAchievement(currentPlayer, 'speed_demon', io, currentRoom);
          }
          // Lucky : trouver après 2 vies perdues ce round
          if ((room.playerMisses[socket.id] || 0) >= 2) {
            unlockAchievement(currentPlayer, 'lucky', io, currentRoom);
          }
        }

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

    // Charger la note d'un track pour l'utilisateur courant
    socket.on('note:load', async ({ trackId }, callback) => {
      if (!currentUserId) {
        if (callback) callback({ note: '' });
        return;
      }
      try {
        const record = await prisma.userTrackNote.findUnique({
          where: { userId_trackId: { userId: currentUserId, trackId } },
        });
        if (callback) callback({ note: record?.note || '' });
        else socket.emit('note:data', { trackId, note: record?.note || '' });
      } catch (err) {
        console.error('[NOTE] Erreur load:', err);
        if (callback) callback({ note: '' });
      }
    });

    // Sauvegarder la note d'un track
    socket.on('note:save', async ({ trackId, note }) => {
      if (!currentUserId) return;
      try {
        await prisma.userTrackNote.upsert({
          where: { userId_trackId: { userId: currentUserId, trackId } },
          update: { note: String(note || '').slice(0, 100) },
          create: { userId: currentUserId, trackId, note: String(note || '').slice(0, 100) },
        });
        socket.emit('note:saved', { trackId });
      } catch (err) {
        console.error('[NOTE] Erreur save:', err);
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
  async function nextTrack(room, roomCode, io) {
    room.currentTrackIndex++;
    room.roundFinders = new Set();
    room.playerMisses = {};
    room.players.forEach(p => p.hasFoundThisRound = false);

    if (room.currentTrackIndex >= room.tracks.length) {
      // Fin de partie
      room.isPlaying = false;
      const sortedPlayers = room.players.sort((a, b) => b.score - a.score);
      const categories = [...new Set(room.tracks.map(t => t.categoryId))];
      const totalTracks = room.tracks.length;

      // Sauvegarder résultats pour joueurs connectés
      for (let i = 0; i < sortedPlayers.length; i++) {
        const p = sortedPlayers[i];
        await saveLadderScore(p.pseudo, p.score);
        await saveGameResult({
          userId: p.userId || null,
          score: p.score,
          rank: i + 1,
          totalPlayers: sortedPlayers.length,
          tracksFound: p.tracksFound || 0,
          totalTracks,
          categories,
          roomCode,
        });
        await checkAndUnlockAchievements(p, {
          rank: i + 1,
          totalPlayers: sortedPlayers.length,
          tracksFound: p.tracksFound || 0,
          totalTracks,
        }, io, roomCode);
      }

      io.to(roomCode).emit('game:end', {
        players: sortedPlayers,
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
      difficulty: currentTrack.difficulty || null,
    });

    startTimer(room, roomCode, io);
  }

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
