'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import { normalizeAnswer } from '@/lib/utils';
import Timer from '@/components/Timer';
import AudioPlayer from '@/components/AudioPlayer';
import PlayerList from '@/components/PlayerList';
import RevealImage from '@/components/RevealImage';
import ReportButton from '@/components/ReportButton';
import VolumeSlider from '@/components/VolumeSlider';
import { Player, ChatMessage, RoomState, Category } from '@/types';

interface TrackSuggestion {
  title: string;
  titleVF: string | null;
  acceptedAnswers: string[];
  categoryId: string;
}

const ICONS: Record<string, string> = {
  film: '🎬',
  tv: '📺',
  gamepad: '🎮',
  sparkles: '✨',
  music: '🎵',
  default: '📁',
};

export default function MultiGameRoom() {
  const params = useParams();
  const router = useRouter();
  const roomCode = params.roomCode as string;

  const [room, setRoom] = useState<RoomState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [resultTitle, setResultTitle] = useState('');
  const [resultTitleVF, setResultTitleVF] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [resultTrackId, setResultTrackId] = useState<number | null>(null);
  const [previousTrackId, setPreviousTrackId] = useState<number | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [winnerPseudo, setWinnerPseudo] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [finalScores, setFinalScores] = useState<Player[]>([]);
  const [categoryStats, setCategoryStats] = useState<Record<string, Record<string, number>>>({});
  const [publicCountdown, setPublicCountdown] = useState<number | null>(null);
  const [volume, setVolume] = useState(0.7);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(null);
  const [allAnswers, setAllAnswers] = useState<TrackSuggestion[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<TrackSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // États pour le système de score Skribbl.io
  const [hasFoundThisRound, setHasFoundThisRound] = useState(false);
  const [myScoreThisRound, setMyScoreThisRound] = useState<number | null>(null);
  const [findersCount, setFindersCount] = useState(0);
  const [roundFinders, setRoundFinders] = useState<{id: string; pseudo: string}[]>([]);
  const [hintMessage, setHintMessage] = useState<string | null>(null);

  // Système de points de vie
  const [remainingLives, setRemainingLives] = useState(3);

  const socketRef = useRef(getSocket());
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const myId = socketRef.current.id;

  // Charger les catégories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await fetch('/api/categories');
        if (res.ok) {
          setCategories(await res.json());
        }
      } catch (error) {
        console.error('Erreur chargement catégories:', error);
      }
    };
    loadCategories();
  }, []);

  // Fonction pour charger les réponses disponibles
  const loadAnswers = async (categoryIds: string[]) => {
    try {
      // Si tableau vide, charger toutes les catégories (room publique)
      const url = categoryIds.length > 0
        ? `/api/answers?categories=${categoryIds.join(',')}`
        : '/api/answers'; // Pas de filtre = toutes les catégories

      const res = await fetch(url);
      if (res.ok) {
        const answers = await res.json();
        setAllAnswers(answers);
      }
    } catch (error) {
      console.error('Erreur chargement réponses:', error);
    }
  };

  useEffect(() => {
    const socket = socketRef.current;

    const onBeforeUnload = () => {
      socket.emit('room:leave');
    };

    window.addEventListener('beforeunload', onBeforeUnload);

    // Try to rejoin the room if we have a stored pseudo (handles reconnects / navigation)
    const storedPseudo = (() => {
      try { return sessionStorage.getItem('blindtest_pseudo'); } catch { return null; }
    })();

    if (!storedPseudo) {
      // No pseudo stored — go back to home
      router.push('/');
    } else {
      // If this client just created the room, skip the explicit join (server already added the creator)
      const justCreatedRoom = (() => {
        try { return sessionStorage.getItem('blindtest_created_room'); } catch { return null; }
      })();

      if (justCreatedRoom === roomCode) {
        try { sessionStorage.removeItem('blindtest_created_room'); } catch {}

        // Request the room state directly
        socket.emit('room:state', (state: RoomState | null) => {
          if (!state) {
            router.push('/');
            return;
          }
          setRoom(state);

          // Charger les réponses disponibles ([] = toutes les catégories pour room publique)
          if (state.categories !== undefined) {
            loadAnswers(state.categories);
          }

          if (state.isPlaying && state.currentTrack) {
            setIsPlaying(true);
            setTimeRemaining(state.timeRemaining);
            setCurrentCategoryId((state.currentTrack as any).categoryId || null);
          }
          // Si room publique avec countdown en cours
          if (state.isPublic && state.isCountingDown && state.startCountdownValue) {
            setPublicCountdown(state.startCountdownValue);
          }
        });
      } else {
        console.log('[multi-room] attempting join with pseudo', storedPseudo);
        socket.emit('room:join', roomCode, storedPseudo, (success: boolean, errorMsg?: string, finalPseudo?: string) => {
          if (!success) {
            console.warn('[multi-room] join failed', errorMsg);
            router.push('/');
            return;
          }

          // Persist final pseudo (server may have modified it)
          try { sessionStorage.setItem('blindtest_pseudo', finalPseudo || storedPseudo); } catch {}

          // Now request the room state
          socket.emit('room:state', (state: RoomState | null) => {
            if (!state) {
              router.push('/');
              return;
            }
            setRoom(state);

            // Charger les réponses disponibles ([] = toutes les catégories pour room publique)
            if (state.categories !== undefined) {
              loadAnswers(state.categories);
            }

            if (state.isPlaying && state.currentTrack) {
              setIsPlaying(true);
              setTimeRemaining(state.timeRemaining);
              setCurrentCategoryId((state.currentTrack as any).categoryId || null);
            }
            // Si room publique avec countdown en cours
            if (state.isPublic && state.isCountingDown && state.startCountdownValue) {
              setPublicCountdown(state.startCountdownValue);
            }
          });
        });
      }
    }

    socket.on('room:player-joined', (player: Player) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return { ...prev, players: [...prev.players, player] };
      });
    });

    socket.on('room:player-left', (playerId: string) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return { ...prev, players: prev.players.filter((p) => p.id !== playerId) };
      });
    });

    socket.on('room:new-host', (hostId: string) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return { ...prev, hostId };
      });
    });

    socket.on('game:start', (data: { trackIndex: number; trackId: number; imageFile?: string; timeLimit: number; startTime?: number; totalTracks: number; categoryId?: string }) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          isPlaying: true,
          currentTrackIndex: data.trackIndex,
          currentTrack: { trackId: data.trackId, imageFile: data.imageFile || null, timeLimit: data.timeLimit, startTime: data.startTime || 0 },
          totalTracks: data.totalTracks,
          players: prev.players.map((p) => ({ ...p, score: 0 })),
        };
      });
      setIsPlaying(true);
      setShowResult(false);
      setTimeRemaining(data.timeLimit);
      setWinnerId(null);
      setResultImage(null);
      setIsFinished(false);
      setCurrentCategoryId(data.categoryId || null);
      setPreviousTrackId(null);
      // Reset états Skribbl
      setHasFoundThisRound(false);
      setMyScoreThisRound(null);
      setFindersCount(0);
      setRoundFinders([]);
      // Reset vies
      setRemainingLives(3);
    });

    socket.on('game:tick', (time: number) => {
      setTimeRemaining(time);
    });

    socket.on('chat:message', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    // Indice: réponse proche
    socket.on('chat:hint', (data: { message: string }) => {
      setHintMessage(data.message);
      setTimeout(() => setHintMessage(null), 3000);
    });

    // Réponse incorrecte depuis suggestion
    socket.on('game:wrong-answer', () => {
      console.log('[LIVES] Mauvaise réponse ! Perte d\'une vie');
      setRemainingLives(prev => {
        const newLives = Math.max(0, prev - 1);
        console.log('[LIVES] Vies restantes:', newLives);
        return newLives;
      });
    });

    // Notification privée: tu as trouvé la réponse
    socket.on('game:you-found', (data: { scoreEarned: number; timeRemaining: number; isFirst: boolean }) => {
      setHasFoundThisRound(true);
      setMyScoreThisRound(data.scoreEarned);
    });

    // Notification publique: quelqu'un a trouvé (sans révéler la réponse)
    socket.on('game:player-found', (data: { playerId: string; pseudo: string; players: Player[]; findersCount: number; totalPlayers: number }) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return { ...prev, players: data.players };
      });
      setFindersCount(data.findersCount);
    });

    // Fin du round: révèle la réponse à tous
    socket.on('game:round-end', (data: { trackId?: number; title: string; titleVF?: string; imageFile?: string; finders: {id: string; pseudo: string}[]; players: Player[]; totalFound: number }) => {
      setShowResult(true);
      setResultTitle(data.title);
      setResultTitleVF(data.titleVF || null);
      setResultImage(data.imageFile || null);
      setResultTrackId(data.trackId || null);
      setRoundFinders(data.finders);
      setRoom((prev) => {
        if (!prev) return prev;
        return { ...prev, players: data.players };
      });
    });

    socket.on('game:next', (data: { trackIndex: number; trackId: number; imageFile?: string; timeLimit: number; startTime?: number; totalTracks: number; categoryId?: string }) => {
      // Arrêter la musique actuelle avant de passer à la suivante
      setIsPlaying(false);

      // Sauvegarder l'ID de la track actuelle avant de changer
      setRoom((prev) => {
        if (!prev) return prev;
        setPreviousTrackId(prev.currentTrack?.trackId || null);
        return {
          ...prev,
          currentTrackIndex: data.trackIndex,
          currentTrack: { trackId: data.trackId, imageFile: data.imageFile || null, timeLimit: data.timeLimit, startTime: data.startTime || 0 },
          totalTracks: data.totalTracks,
        };
      });
      setShowResult(false);
      setTimeRemaining(data.timeLimit);
      setWinnerId(null);
      setResultImage(null);
      setResultTrackId(null);
      setIsPlaying(true);
      setCurrentCategoryId(data.categoryId || null);
      // Reset états Skribbl
      setHasFoundThisRound(false);
      setMyScoreThisRound(null);
      setFindersCount(0);
      setRoundFinders([]);
      // Reset vies
      setRemainingLives(3);
    });

    socket.on('game:end', (data: { players: Player[]; categoryStats?: Record<string, Record<string, number>> }) => {
      setIsFinished(true);
      setFinalScores(data.players);
      setCategoryStats(data.categoryStats || {});
      setIsPlaying(false);
      setShowResult(false);
      setPreviousTrackId(null);
    });

    // Countdown de la room publique
    socket.on('public:countdown', (countdown: number) => {
      setPublicCountdown(countdown);
      if (countdown <= 0) {
        setPublicCountdown(null);
      }
    });

    socket.on('public:restart-countdown', (countdown: number) => {
      setPublicCountdown(countdown);
      if (countdown <= 0) {
        setPublicCountdown(null);
        setIsFinished(false);
      }
    });

    return () => {
      // Emit leave when the component unmounts so server state is cleaned up
      socket.emit('room:leave');
      window.removeEventListener('beforeunload', onBeforeUnload);

      socket.off('room:player-joined');
      socket.off('room:player-left');
      socket.off('room:new-host');
      socket.off('game:start');
      socket.off('game:tick');
      socket.off('chat:message');
      socket.off('chat:hint');
      socket.off('game:you-found');
      socket.off('game:player-found');
      socket.off('game:round-end');
      socket.off('game:next');
      socket.off('game:end');
      socket.off('public:countdown');
      socket.off('public:restart-countdown');
      socket.off('game:wrong-answer');
    };
  }, [router, roomCode]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isPlaying) {
      inputRef.current?.focus();
    }
  }, [isPlaying]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (selectedIndex >= 0 && dropdownRef.current) {
      const selected = dropdownRef.current.children[selectedIndex] as HTMLElement;
      selected?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  const handleLeave = () => {
    // Inform the server we leave, clear stored pseudo and go back to the lobby
    socketRef.current.emit('room:leave');
    try { sessionStorage.removeItem('blindtest_pseudo'); } catch {}
    router.push('/');
  };

  const handleInputChange = (value: string) => {
    setInput(value);

    if (!allAnswers || value.trim().length < 2 || !currentCategoryId || remainingLives === 0) {
      setShowDropdown(false);
      return;
    }

    const normalized = normalizeAnswer(value);
    const matches = allAnswers
      .filter(track => {
        // Filtrer uniquement par la catégorie actuelle
        if (track.categoryId !== currentCategoryId) return false;

        // Rechercher dans le titre VO
        const titleNorm = normalizeAnswer(track.title);
        if (titleNorm.includes(normalized)) return true;

        // Rechercher dans le titre VF
        if (track.titleVF) {
          const titleVFNorm = normalizeAnswer(track.titleVF);
          if (titleVFNorm.includes(normalized)) return true;
        }

        // Rechercher dans les réponses acceptées
        return track.acceptedAnswers.some(answer => {
          const answerNorm = normalizeAnswer(answer);
          return answerNorm.includes(normalized);
        });
      })
      .slice(0, 8);

    setFilteredSuggestions(matches);
    setShowDropdown(matches.length > 0);
    setSelectedIndex(matches.length > 0 ? 0 : -1);
  };

  const selectSuggestion = (suggestion: TrackSuggestion) => {
    setInput(suggestion.title);
    setShowDropdown(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || filteredSuggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Tab':
        e.preventDefault();
        selectSuggestion(filteredSuggestions[selectedIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        setShowDropdown(false);
        break;
      case 'Enter':
        e.preventDefault();
        selectSuggestion(filteredSuggestions[selectedIndex]);
        break;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !isPlaying) return;

    socketRef.current.emit('game:answer', input.trim());
    setInput('');
    setShowDropdown(false);
  };

  const handleStartGame = () => {
    socketRef.current.emit('game:start');
  };

  if (!room) {
    return (
      <div className="min-h-screen aero-bg flex items-center justify-center">
        <div className="glass rounded-xl px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-3 border-[#7ec8e3] border-t-transparent rounded-full animate-spin" />
            <span className="text-white text-xl">Chargement...</span>
          </div>
        </div>
      </div>
    );
  }

  // Écran de fin
  if (isFinished) {
    return (
      <div className="min-h-screen aero-bg flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#7fba00]/20 flex items-center justify-center glow-green">
            <span className="text-4xl">🏆</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-6 text-glow">Partie terminée !</h1>
          <div className="space-y-3 mb-8">
            {finalScores.map((player, index) => {
              const playerStats = categoryStats[player.id] || {};
              const hasStats = Object.keys(playerStats).length > 0;

              return (
                <div
                  key={player.id}
                  className={`p-4 rounded-xl ${
                    index === 0
                      ? 'bg-[#7fba00]/20 border border-[#7fba00]/50 glow-green'
                      : 'bg-white/5 border border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : ''}
                      </span>
                      <span className="text-white font-semibold">{player.pseudo}</span>
                    </div>
                    <span className="text-[#7fba00] font-bold text-xl">{player.score}</span>
                  </div>

                  {hasStats && (
                    <div className="flex flex-wrap gap-2 mt-2 pl-10">
                      {Object.entries(playerStats).map(([categoryId, count]) => {
                        const category = categories.find((c) => c.id === categoryId);
                        if (!category) return null;
                        const icon = ICONS[category.icon] || ICONS.default;

                        return (
                          <div
                            key={categoryId}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg glass"
                            style={{ borderColor: category.color, borderWidth: '1px' }}
                          >
                            <span style={{ color: category.color }} className="text-sm">
                              {icon}
                            </span>
                            <span className="text-white/80 text-sm font-medium">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {room.isPublic && publicCountdown !== null && (
            <div className="glass rounded-xl p-6 mb-4">
              <p className="text-white/60 mb-2">Nouvelle partie dans</p>
              <div className="text-6xl font-bold text-[#7ec8e3] text-glow">
                {publicCountdown}
              </div>
              <p className="text-white/40 text-sm mt-2">secondes</p>
            </div>
          )}
          {!room.isPublic && room.hostId === myId && (
            <button
              onClick={handleStartGame}
              className="btn-aero-green w-full px-6 py-3 text-white rounded-xl font-semibold mb-3"
            >
              🔄 Rejouer
            </button>
          )}
          <button
            onClick={handleLeave}
            className="btn-aero w-full px-6 py-3 text-white rounded-xl"
          >
            {room.isPublic ? '🏠 Retour à l\'accueil' : '🚪 Quitter'}
          </button>
        </div>
      </div>
    );
  }

  // Salle d'attente
  if (!room.isPlaying && !room.currentTrack) {
    return (
      <div className="min-h-screen aero-bg p-4">
        <div className="max-w-md mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleLeave}
              className="glass px-4 py-2 rounded-lg text-white/70 hover:text-white transition-colors"
            >
              ← Quitter
            </button>
            <div className="glass px-4 py-2 rounded-lg text-[#7ec8e3]">
              {room.isPublic ? '🌍 Partie Publique' : '👥 Partie Multi'}
            </div>
          </div>

          <div className="glass rounded-2xl p-6">
            <h1 className="text-2xl font-bold text-white mb-2">
              {room.isPublic ? 'Partie Publique' : 'Room'}
            </h1>
            {!room.isPublic && (
              <>
                <div className="flex items-center gap-3">
                  <code className="text-4xl font-mono text-[#7ec8e3] tracking-[0.2em] text-glow">
                    {roomCode}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(roomCode)}
                    className="glass p-2 rounded-lg text-white/60 hover:text-white transition-colors cursor-pointer"
                    title="Copier le code"
                  >
                    📋
                  </button>
                </div>
                <p className="text-white/50 text-sm mt-3">
                  Partage ce code pour inviter des amis
                </p>
              </>
            )}
            {room.isPublic && (
              <p className="text-white/50 text-sm mt-2">
                25 musiques aléatoires
              </p>
            )}
          </div>

          <PlayerList
            players={room.players}
            hostId={room.hostId}
            currentPlayerId={myId}
          />

          <div className="mt-6">
            {room.isPublic ? (
              // Affichage du countdown pour la room publique
              <div className="glass rounded-xl p-6 text-center">
                {publicCountdown !== null ? (
                  <>
                    <p className="text-white/60 mb-2">La partie commence dans</p>
                    <div className="text-6xl font-bold text-[#7ec8e3] text-glow">
                      {publicCountdown}
                    </div>
                    <p className="text-white/40 text-sm mt-2">secondes</p>
                  </>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-white/60">
                    <div className="w-4 h-4 border-2 border-[#7ec8e3] border-t-transparent rounded-full animate-spin" />
                    En attente de joueurs...
                  </div>
                )}
              </div>
            ) : room.hostId === myId ? (
              <button
                onClick={handleStartGame}
                disabled={room.players.length < 1}
                className="btn-aero-green w-full px-6 py-4 text-white text-lg font-semibold rounded-xl disabled:opacity-50"
              >
                🚀 Lancer la partie
              </button>
            ) : (
              <div className="glass rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-white/60">
                  <div className="w-4 h-4 border-2 border-[#7ec8e3] border-t-transparent rounded-full animate-spin" />
                  En attente que l&apos;hôte lance la partie...
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Jeu en cours
  return (
    <div className="min-h-screen aero-bg p-4">
      {/* Slider de volume */}
      <VolumeSlider onVolumeChange={setVolume} />

      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleLeave}
            className="glass px-4 py-2 rounded-lg text-white/70 hover:text-white transition-colors"
          >
            ← Quitter
          </button>
          <div className="glass px-4 py-2 rounded-lg text-[#7ec8e3]">
            {room.isPublic ? '🌍 Partie Publique' : '👥 Partie Multi'}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Colonne principale */}
          <div className="lg:col-span-2 space-y-4">
            {/* Info musique */}
            <div className="flex justify-center items-center glass rounded-xl p-3">
              <span className="text-white/60">
                Musique {(room.currentTrackIndex || 0) + 1} / {room.totalTracks}
              </span>
            </div>

            {/* Timer */}
            <Timer
              timeRemaining={timeRemaining}
              totalTime={room.currentTrack?.timeLimit || 30}
              trackId={!showResult ? room.currentTrack?.trackId : undefined}
              previousTrackId={!showResult ? previousTrackId || undefined : undefined}
            />

            {/* Audio */}
            <div className="flex justify-center py-4">
              <AudioPlayer
                trackId={room.currentTrack?.trackId || 0}
                isPlaying={isPlaying}
                startTime={room.currentTrack?.startTime || 0}
                volume={volume}
              />
            </div>

            {/* Indicateur "Tu as trouvé" */}
            {hasFoundThisRound && !showResult && (
              <div className="glass rounded-xl p-4 text-center bg-[#7fba00]/20 border border-[#7fba00]/50">
                <p className="text-[#7fba00] font-semibold text-lg">
                  Tu as trouvé! +{myScoreThisRound} pts
                </p>
                <p className="text-white/60 text-sm mt-1">
                  En attente de la fin du round...
                </p>
              </div>
            )}

            {/* Indicateur nombre de joueurs qui ont trouvé */}
            {findersCount > 0 && !hasFoundThisRound && !showResult && (
              <div className="glass rounded-xl p-3 text-center">
                <p className="text-white/70">
                  {findersCount} joueur{findersCount > 1 ? 's ont' : ' a'} trouvé!
                </p>
              </div>
            )}

            {/* Résultat */}
            {showResult && (
              <div
                className={`glass rounded-xl p-6 text-center ${
                  roundFinders.length > 0 ? 'glow-green' : ''
                }`}
              >
                {roundFinders.length > 0 ? (
                  <>
                    <p className="text-[#7fba00] text-xl font-semibold">
                      {roundFinders.length === 1
                        ? `✓ ${roundFinders[0].pseudo} a trouvé!`
                        : `✓ ${roundFinders.length} joueurs ont trouvé!`}
                    </p>
                    {roundFinders.length > 1 && (
                      <p className="text-white/60 text-sm mt-1">
                        {roundFinders.map(f => f.pseudo).join(', ')}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-red-400 text-xl font-semibold">
                    ✗ Personne n&apos;a trouvé!
                  </p>
                )}

                {/* Image de révélation */}
                {resultImage && (
                  <div className="my-4 flex justify-center">
                    <RevealImage
                      src={resultImage}
                      alt={resultTitle}
                      className="max-w-xs"
                    />
                  </div>
                )}

                <p className="text-3xl font-bold text-white mt-3 text-glow">{resultTitle}</p>
                {resultTitleVF && (
                  <p className="text-xl text-white/70 mt-1">
                    ({resultTitleVF})
                  </p>
                )}
                {resultTrackId && (
                  <div className="mt-2">
                    <ReportButton trackId={resultTrackId} />
                  </div>
                )}
              </div>
            )}

            {/* Catégorie */}
            {currentCategoryId && !showResult && (
              <div className="flex justify-center">
                {(() => {
                  const category = categories.find((c) => c.id === currentCategoryId);
                  if (!category) return null;
                  const icon = ICONS[category.icon] || ICONS.default;
                  return (
                    <div
                      className="glass rounded-xl px-4 py-2 flex items-center gap-2"
                      style={{ borderColor: category.color, borderWidth: '2px' }}
                    >
                      <span style={{ color: category.color }} className="text-xl">
                        {icon}
                      </span>
                      <span className="text-white font-semibold">{category.name}</span>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Points de vie */}
            {!showResult && isPlaying && (
              <div className="flex justify-center">
                <div className="glass rounded-xl px-4 py-2 flex items-center gap-2">
                  <span className="text-white/60 text-sm font-semibold">Vies :</span>
                  <div className="flex gap-1">
                    {[1, 2, 3].map((heart) => (
                      <span
                        key={heart}
                        className={`text-xl transition-all ${
                          heart <= remainingLives
                            ? 'opacity-100 scale-100'
                            : 'opacity-30 scale-75'
                        }`}
                      >
                        {heart <= remainingLives ? '❤️' : '🖤'}
                      </span>
                    ))}
                  </div>
                  {remainingLives === 0 && (
                    <span className="text-red-400 text-xs ml-2">(Chat uniquement)</span>
                  )}
                </div>
              </div>
            )}

            {/* Chat / Réponses */}
            <div className="relative">
              <div className="glass rounded-xl overflow-hidden">
                <div
                  ref={chatRef}
                  className="h-48 overflow-y-auto p-4 space-y-2"
                >
                  {messages.length === 0 ? (
                    <p className="text-white/40 text-center italic">
                      Les réponses apparaîtront ici...
                    </p>
                  ) : (
                    messages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2 ${
                          msg.isCorrect ? 'animate-pulse bg-green-500/10 border border-green-500/30 rounded px-2 py-1' : ''
                        } ${
                          msg.isFromFinder ? 'opacity-90' : ''
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <span
                            className={`font-semibold ${
                              msg.isFromFinder
                                ? 'text-[#4a90d9]'
                                : msg.playerId === myId
                                  ? 'text-[#7ec8e3]'
                                  : 'text-[#4a90d9]'
                            }`}
                          >
                            {msg.pseudo}
                          </span>
                          {msg.isFromFinder && (
                            <span className="text-[#4a90d9] text-sm" title="Message d'un gagnant">
                              👑
                            </span>
                          )}
                          <span
                            className={`font-semibold ${
                              msg.isFromFinder
                                ? 'text-[#4a90d9]'
                                : msg.playerId === myId
                                  ? 'text-[#7ec8e3]'
                                  : 'text-[#4a90d9]'
                            }`}
                          >
                            :
                          </span>
                        </div>
                        <span
                          className={
                            msg.isCorrect
                              ? 'text-[#7fba00] font-bold'
                              : 'text-white/70'
                          }
                        >
                          {msg.message}
                        </span>
                        {msg.isCorrect && <span className="text-[#7fba00]">✓</span>}
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleSubmit} className="flex border-t border-white/20">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!isPlaying}
                    placeholder={
                      isPlaying
                        ? 'Devine la musique...'
                        : 'En attente...'
                    }
                    className="input-aero flex-1 px-4 py-3 text-white rounded-none border-0"
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-controls="autocomplete-dropdown"
                    aria-expanded={showDropdown}
                  />
                  <button
                    type="submit"
                    disabled={!isPlaying || !input.trim()}
                    className="btn-aero px-6 py-3 text-white rounded-none border-0 border-l border-white/20 disabled:opacity-50"
                  >
                    Envoyer
                  </button>
                </form>
              </div>

              {showDropdown && filteredSuggestions.length > 0 && (
                <div
                  ref={dropdownRef}
                  id="autocomplete-dropdown"
                  role="listbox"
                  className="absolute left-0 right-0 mt-1 glass rounded-lg overflow-hidden max-h-[240px] overflow-y-auto z-50"
                >
                  {filteredSuggestions.map((suggestion, index) => {
                    const displayText = suggestion.titleVF
                      ? `${suggestion.title} - ${suggestion.titleVF}`
                      : suggestion.title;

                    return (
                      <div
                        key={index}
                        role="option"
                        aria-selected={index === selectedIndex}
                        onClick={() => selectSuggestion(suggestion)}
                        className={`px-4 py-3 cursor-pointer transition-colors ${
                          index === selectedIndex
                            ? 'bg-[#4a90d9]/40 border-l-4 border-[#4a90d9] text-white font-semibold'
                            : index === 0 && selectedIndex === -1
                              ? 'bg-[#4a90d9]/20 border-l-2 border-[#4a90d9]/50 text-white'
                              : 'hover:bg-white/10 text-white/90'
                        }`}
                      >
                        {displayText}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Message hint en bas */}
              {hintMessage && (
                <div className="absolute -bottom-16 left-0 right-0 glass rounded-xl p-3 bg-orange-500/20 border border-orange-500/50">
                  <p className="text-orange-300 font-semibold text-sm flex items-center justify-center gap-2">
                    <span>💡</span>
                    {hintMessage}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Liste des joueurs */}
          <div className="lg:col-span-1">
            <PlayerList
              players={room.players}
              hostId={room.hostId}
              currentPlayerId={myId}
              roundFinders={room.roundFinders}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
