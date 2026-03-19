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
import DeterminossNotif from '@/components/DeterminossNotif';
import TrackHistoryPanel, { PlayedTrack } from '@/components/TrackHistoryPanel';
import Link from 'next/link';
import UserAvatar from '@/components/UserAvatar';
import { Player, ChatMessage, RoomState, Category } from '@/types';

interface TrackSuggestion {
  title: string;
  titleVF: string | null;
  acceptedAnswers: string[];
  categoryId: string;
}

interface Emote {
  id: number;
  code: string;
  imageFile: string | null;
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
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [winnerPseudo, setWinnerPseudo] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [finalScores, setFinalScores] = useState<Player[]>([]);
  const [categoryStats, setCategoryStats] = useState<Record<string, Record<string, number>>>({});
  const [publicCountdown, setPublicCountdown] = useState<number | null>(null);
  const [volume, setVolume] = useState(0.7);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(null);
  const [currentDifficulty, setCurrentDifficulty] = useState<string | null>(null);
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
  const [gameStartKey, setGameStartKey] = useState(0);

  // Emotes
  const [emotes, setEmotes] = useState<Emote[]>([]);
  const [showEmoteDropdown, setShowEmoteDropdown] = useState(false);
  const [filteredEmotes, setFilteredEmotes] = useState<Emote[]>([]);
  const [selectedEmoteIndex, setSelectedEmoteIndex] = useState(-1);
  const emoteDropdownRef = useRef<HTMLDivElement>(null);

  // Historique des tracks joués + notes
  const [playedTracks, setPlayedTracks] = useState<PlayedTrack[]>([]);
  const [trackNotes, setTrackNotes] = useState<Record<number, string>>({});
  const [noteSaveStatus, setNoteSaveStatus] = useState<Record<number, 'saving' | 'saved'>>({});
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const socketRef = useRef(getSocket());
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentDifficultyRef = useRef<string | null>(null);
  const currentCategoryIdRef = useRef<string | null>(null);
  const trackNotesRef = useRef<Record<number, string>>({});
  const noteDebounceRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const myId = socketRef.current.id;

  // Charger les catégories + vérifier si connecté
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
    const checkUser = async () => {
      try {
        const res = await fetch('/api/user/me');
        if (res.ok) {
          const data = await res.json();
          setIsLoggedIn(!!data.user);
        }
      } catch {}
    };
    const loadEmotes = async () => {
      try {
        const res = await fetch('/api/emotes');
        if (res.ok) setEmotes(await res.json());
      } catch {}
    };
    loadCategories();
    checkUser();
    loadEmotes();
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
      try { return sessionStorage.getItem('blindtoss_pseudo'); } catch { return null; }
    })();

    if (!storedPseudo) {
      // No pseudo stored — go back to home
      router.push('/');
    } else {
      // If this client just created the room, skip the explicit join (server already added the creator)
      const justCreatedRoom = (() => {
        try { return sessionStorage.getItem('blindtoss_created_room'); } catch { return null; }
      })();

      if (justCreatedRoom === roomCode) {
        try { sessionStorage.removeItem('blindtoss_created_room'); } catch {}

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
          try { sessionStorage.setItem('blindtoss_pseudo', finalPseudo || storedPseudo); } catch {}

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

    socket.on('game:start', (data: { trackIndex: number; trackId: number; imageFile?: string; timeLimit: number; startTime?: number; totalTracks: number; categoryId?: string; difficulty?: string | null }) => {
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
      if (data.trackIndex === 0) {
        setGameStartKey((k) => k + 1);
        setPlayedTracks([]);
        try { sessionStorage.removeItem('blindtoss_reported_tracks'); } catch { /* ignore */ }
      }
      // Flush les notes en attente avant le prochain round
      Object.entries(noteDebounceRef.current).forEach(([trackIdStr, timer]) => {
        clearTimeout(timer);
        const trackId = Number(trackIdStr);
        const note = trackNotesRef.current[trackId];
        if (note !== undefined) socket.emit('note:save', { trackId, note });
      });
      noteDebounceRef.current = {};
      setResultImage(null);
      setIsFinished(false);
      setCurrentCategoryId(data.categoryId || null);
      setCurrentDifficulty(data.difficulty || null);
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

      // Ajouter au panel historique
      if (data.trackId) {
        const myId = socket.id;
        const gotIt = data.finders.some(f => f.id === myId);
        setPlayedTracks(prev => {
          if (prev.some(t => t.trackId === data.trackId)) return prev;
          return [...prev, {
            trackId: data.trackId!,
            title: data.title,
            titleVF: data.titleVF || null,
            imageFile: data.imageFile || null,
            difficulty: currentDifficultyRef.current,
            categoryId: currentCategoryIdRef.current,
            gotIt,
          }];
        });
        // Charger la note existante
        socket.emit('note:load', { trackId: data.trackId }, ({ note }: { note: string }) => {
          if (note) setTrackNotes(prev => ({ ...prev, [data.trackId!]: note }));
        });
      }
    });

    socket.on('game:next', (data: { trackIndex: number; trackId: number; imageFile?: string; timeLimit: number; startTime?: number; totalTracks: number; categoryId?: string; difficulty?: string | null }) => {
      // Arrêter la musique actuelle avant de passer à la suivante
      setIsPlaying(false);

      setRoom((prev) => {
        if (!prev) return prev;
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
      setCurrentDifficulty(data.difficulty || null);
      // Reset états Skribbl
      setHasFoundThisRound(false);
      setMyScoreThisRound(null);
      setFindersCount(0);
      setRoundFinders([]);
      // Reset vies
      setRemainingLives(3);
    });

    socket.on('game:end', (data: { players: Player[]; categoryStats?: Record<string, Record<string, number>> }) => {
      // Flush les notes en attente avant la fin de partie
      Object.entries(noteDebounceRef.current).forEach(([trackIdStr, timer]) => {
        clearTimeout(timer);
        const trackId = Number(trackIdStr);
        const note = trackNotesRef.current[trackId];
        if (note !== undefined) socket.emit('note:save', { trackId, note });
      });
      noteDebounceRef.current = {};
      setIsFinished(true);
      setFinalScores(data.players);
      setCategoryStats(data.categoryStats || {});
      setIsPlaying(false);
      setShowResult(false);
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

    socket.on('note:saved', ({ trackId }: { trackId: number }) => {
      setNoteSaveStatus(prev => ({ ...prev, [trackId]: 'saved' }));
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
      socket.off('note:saved');
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

  // Synchroniser les refs pour les closures WebSocket
  useEffect(() => { currentDifficultyRef.current = currentDifficulty; }, [currentDifficulty]);
  useEffect(() => { currentCategoryIdRef.current = currentCategoryId; }, [currentCategoryId]);
  useEffect(() => { trackNotesRef.current = trackNotes; }, [trackNotes]);

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

  useEffect(() => {
    if (selectedEmoteIndex >= 0 && emoteDropdownRef.current) {
      const selected = emoteDropdownRef.current.children[selectedEmoteIndex] as HTMLElement;
      selected?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedEmoteIndex]);

  const handleLeave = () => {
    // Inform the server we leave, clear stored pseudo and go back to the lobby
    socketRef.current.emit('room:leave');
    try { sessionStorage.removeItem('blindtoss_pseudo'); } catch {}
    router.push('/');
  };

  const selectEmote = (emote: Emote) => {
    const newInput = input.replace(/:([a-zA-Z0-9_]*)$/, `:${emote.code}: `);
    setInput(newInput);
    setShowEmoteDropdown(false);
    setSelectedEmoteIndex(-1);
    inputRef.current?.focus();
  };

  const renderMessageText = (text: string) => {
    if (emotes.length === 0) return text;
    const parts = text.split(/(:[a-zA-Z0-9_]+:)/g);
    if (parts.length === 1) return text;
    return parts.map((part, i) => {
      const match = part.match(/^:([a-zA-Z0-9_]+):$/);
      if (!match) return part;
      const emote = emotes.find(e => e.code === match[1]);
      if (!emote) return part;
      if (emote.imageFile) {
        return <img key={i} src={emote.imageFile} alt={`:${emote.code}:`} title={`:${emote.code}:`} className="inline-block w-6 h-6 object-contain align-middle mx-0.5" />;
      }
      return part;
    });
  };

  const handleInputChange = (value: string) => {
    setInput(value);

    const emoteMatch = value.match(/:([a-zA-Z0-9_]*)$/);
    if (emoteMatch && emotes.length > 0) {
      const query = emoteMatch[1].toLowerCase();
      const matches = emotes.filter(e => e.imageFile && e.code.startsWith(query)).slice(0, 10);
      setFilteredEmotes(matches);
      setShowEmoteDropdown(matches.length > 0);
      setSelectedEmoteIndex(matches.length > 0 ? 0 : -1);
      setShowDropdown(false);
      return;
    }
    setShowEmoteDropdown(false);

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
    // Shift+Tab depuis l'input : focus la dernière note de l'historique
    if (e.key === 'Tab' && e.shiftKey) {
      const allNotes = document.querySelectorAll<HTMLTextAreaElement>('[data-history-note]');
      if (allNotes.length > 0) {
        e.preventDefault();
        allNotes[allNotes.length - 1].focus();
        return;
      }
    }

    // Dropdown emotes
    if (showEmoteDropdown && filteredEmotes.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedEmoteIndex(prev => prev < filteredEmotes.length - 1 ? prev + 1 : prev);
          return;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedEmoteIndex(prev => prev > 0 ? prev - 1 : 0);
          return;
        case 'Tab':
        case 'Enter':
          e.preventDefault();
          if (selectedEmoteIndex >= 0) selectEmote(filteredEmotes[selectedEmoteIndex]);
          return;
        case 'Escape':
          e.preventDefault();
          setShowEmoteDropdown(false);
          return;
      }
    }

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

  const handleNoteChange = (trackId: number, note: string) => {
    setTrackNotes(prev => ({ ...prev, [trackId]: note }));
    // Debounce auto-save 1.5s
    if (noteDebounceRef.current[trackId]) clearTimeout(noteDebounceRef.current[trackId]);
    noteDebounceRef.current[trackId] = setTimeout(() => {
      delete noteDebounceRef.current[trackId];
      setNoteSaveStatus(prev => ({ ...prev, [trackId]: 'saving' }));
      socketRef.current.emit('note:save', { trackId, note });
    }, 1500);
  };

  const handleNoteSave = (trackId: number, note: string) => {
    if (noteDebounceRef.current[trackId]) {
      clearTimeout(noteDebounceRef.current[trackId]);
      delete noteDebounceRef.current[trackId];
    }
    setNoteSaveStatus(prev => ({ ...prev, [trackId]: 'saving' }));
    socketRef.current.emit('note:save', { trackId, note });
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
                      <div className="relative">
                        <UserAvatar avatarFile={player.avatarFile} pseudo={player.pseudo} size={36} />
                        {index < 3 && (
                          <span className="absolute -bottom-1 -right-1 text-sm leading-none">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                          </span>
                        )}
                      </div>
                      {player.username ? (
                        <Link href={`/profile/${player.username}`} className="text-white font-semibold hover:underline">
                          {player.pseudo}
                        </Link>
                      ) : (
                        <span className="text-white font-semibold">{player.pseudo}</span>
                      )}
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
      {/* Notification Determinoss */}
      <DeterminossNotif gameStartKey={gameStartKey} />

      <div className="max-w-7xl mx-auto space-y-4">
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

        <div className="grid grid-cols-1 lg:grid-cols-[270px_80px_1fr_80px_220px] items-start">
          {/* Sidebar gauche - Historique */}
          <div className="hidden lg:block" style={{ height: 'calc(100vh - 140px)', position: 'sticky', top: 16 }}>
            <TrackHistoryPanel
              tracks={playedTracks}
              notes={trackNotes}
              noteSaveStatus={noteSaveStatus}
              isLoggedIn={isLoggedIn}
              onNoteChange={handleNoteChange}
              onNoteSave={handleNoteSave}
              onFocusAnswerInput={() => inputRef.current?.focus()}
            />
          </div>

          {/* Spacer gauche */}
          <div className="hidden lg:block" />

          {/* Colonne principale */}
          <div className="space-y-4">
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
            />

            {/* Zone alternante jeu/reveal — grid overlay pour hauteur stable */}
            <div style={{ display: 'grid' }}>

              {/* État : jeu en cours */}
              <div
                style={{ gridArea: '1 / 1' }}
                className={`flex flex-col justify-between${showResult ? ' invisible pointer-events-none' : ''}`}
              >
                {/* Indicateur "Tu as trouvé" */}
                {hasFoundThisRound ? (
                  <div className="glass rounded-xl p-4 text-center bg-[#7fba00]/20 border border-[#7fba00]/50">
                    <p className="text-[#7fba00] font-semibold text-lg">
                      Tu as trouvé! +{myScoreThisRound} pts
                    </p>
                    <p className="text-white/60 text-sm mt-1">
                      En attente de la fin du round...
                    </p>
                  </div>
                ) : findersCount > 0 ? (
                  <div className="glass rounded-xl p-3 text-center">
                    <p className="text-white/70">
                      {findersCount} joueur{findersCount > 1 ? 's ont' : ' a'} trouvé!
                    </p>
                  </div>
                ) : (
                  <div className="glass rounded-xl p-3 text-center opacity-0 pointer-events-none select-none" aria-hidden>
                    <p className="text-white/70">placeholder</p>
                  </div>
                )}

                {/* Audio — flex-1 pour pousser le disque vers le milieu */}
                <div className="flex-1 flex items-center justify-center">
                  <AudioPlayer
                    trackId={room.currentTrack?.trackId || 0}
                    isPlaying={isPlaying}
                    startTime={room.currentTrack?.startTime || 0}
                    volume={volume}
                  />
                </div>

                {/* Catégorie + Difficulté */}
                <div className="flex justify-center items-center gap-2">
                  {(() => {
                    const category = categories.find((c) => c.id === currentCategoryId);
                    if (!category) return <div className="h-10" />;
                    const icon = ICONS[category.icon] || ICONS.default;
                    return (
                      <div
                        className="glass rounded-xl px-4 py-2 flex items-center gap-2"
                        style={{ borderColor: category.color, borderWidth: '2px' }}
                      >
                        <span style={{ color: category.color }} className="text-xl">{icon}</span>
                        <span className="text-white font-semibold">{category.name}</span>
                      </div>
                    );
                  })()}
                  {currentDifficulty && (() => {
                    const config: Record<string, { label: string; color: string; bg: string; border: string }> = {
                      easy:   { label: 'Facile',    color: '#7fba00', bg: 'rgba(127,186,0,0.15)',  border: 'rgba(127,186,0,0.5)' },
                      medium: { label: 'Moyen',     color: '#f5a623', bg: 'rgba(245,166,35,0.15)', border: 'rgba(245,166,35,0.5)' },
                      hard:   { label: 'Difficile', color: '#e8445a', bg: 'rgba(232,68,90,0.15)',  border: 'rgba(232,68,90,0.5)' },
                    };
                    const d = config[currentDifficulty];
                    if (!d) return null;
                    return (
                      <div
                        className="glass rounded-xl px-3 py-2 flex items-center gap-1.5"
                        style={{ backgroundColor: d.bg, borderColor: d.border, borderWidth: '2px' }}
                      >
                        <span style={{ color: d.color }} className="text-sm font-bold">{d.label}</span>
                      </div>
                    );
                  })()}
                </div>

                {/* Points de vie */}
                <div className="flex justify-center mt-3">
                  <div className="glass rounded-xl px-4 py-2 flex items-center gap-2">
                    <span className="text-white/60 text-sm font-semibold">Vies :</span>
                    <div className="flex gap-1">
                      {[1, 2, 3].map((heart) => (
                        <span
                          key={heart}
                          className={`text-xl transition-all ${
                            heart <= remainingLives ? 'opacity-100 scale-100' : 'opacity-30 scale-75'
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
              </div>

              {/* État : reveal */}
              <div
                style={{ gridArea: '1 / 1' }}
                className={`flex flex-col justify-center${!showResult ? ' invisible pointer-events-none' : ''}`}
              >
                <div className={`glass rounded-xl p-4 text-center ${roundFinders.length > 0 ? 'glow-green' : ''}`}>
                  {roundFinders.length > 0 ? (
                    <>
                      <p className="text-[#7fba00] text-lg font-semibold">
                        {roundFinders.length === 1
                          ? `✓ ${roundFinders[0].pseudo} a trouvé!`
                          : `✓ ${roundFinders.length} joueurs ont trouvé!`}
                      </p>
                      {roundFinders.length > 1 && (
                        <p className="text-white/60 text-sm mt-0.5">
                          {roundFinders.map(f => f.pseudo).join(', ')}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-red-400 text-lg font-semibold">
                      ✗ Personne n&apos;a trouvé!
                    </p>
                  )}

                  {/* Zone image — toujours réservée pour éviter les sauts */}
                  <div className="my-3 flex justify-center">
                    <div style={{ width: '7rem', aspectRatio: '2/3', position: 'relative' }}>
                      {resultImage && (
                        <RevealImage src={resultImage} alt={resultTitle} className="w-full h-full object-cover rounded-lg" />
                      )}
                    </div>
                  </div>

                  {/* Titre — espace toujours réservé */}
                  <p className="text-2xl font-bold text-white mt-2 text-glow min-h-[2rem]">{resultTitle}</p>
                  <p className="text-base text-white/70 mt-0.5 min-h-[1.5rem]">{resultTitleVF ? `(${resultTitleVF})` : ''}</p>
                  <div className="mt-1.5 min-h-[1.75rem]">
                    {resultTrackId && <ReportButton trackId={resultTrackId} />}
                  </div>
                </div>
              </div>

            </div>

            {/* Chat / Réponses */}
            <div className="relative">
              <div className="glass rounded-xl overflow-hidden">
                <div
                  ref={chatRef}
                  className="h-72 overflow-y-auto p-3 space-y-1.5"
                >
                  {messages.length === 0 ? (
                    <p className="text-white/40 text-center italic text-sm mt-8">
                      Les réponses apparaîtront ici...
                    </p>
                  ) : (
                    messages.map((msg, i) => {
                      const pseudoColor = msg.isFromFinder
                        ? 'text-[#4a90d9]'
                        : msg.playerId === myId
                          ? 'text-[#7ec8e3]'
                          : 'text-[#4a90d9]';
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-2 ${
                            msg.isCorrect ? 'bg-green-500/10 border border-green-500/30 rounded-lg px-2 py-1' : 'px-1 py-0.5'
                          } ${msg.isFromFinder ? 'opacity-90' : ''}`}
                        >
                          {msg.username ? (
                            <Link href={`/profile/${msg.username}`} className="shrink-0">
                              <UserAvatar avatarFile={msg.avatarFile} pseudo={msg.pseudo} size={32} />
                            </Link>
                          ) : (
                            <UserAvatar avatarFile={msg.avatarFile} pseudo={msg.pseudo} size={32} className="shrink-0" />
                          )}
                          <p className="text-base leading-snug min-w-0 break-words" style={{ lineHeight: '32px' }}>
                            {msg.username ? (
                              <Link href={`/profile/${msg.username}`} className={`font-semibold hover:underline ${pseudoColor}`}>
                                {msg.pseudo}
                              </Link>
                            ) : (
                              <span className={`font-semibold ${pseudoColor}`}>{msg.pseudo}</span>
                            )}
                            {msg.isFromFinder && <span className="text-xs mx-0.5" title="A déjà trouvé">👑</span>}
                            <span className="text-white/40 mx-1">:</span>
                            <span className={msg.isCorrect ? 'text-[#7fba00] font-bold' : 'text-white/80'}>
                              {renderMessageText(msg.message)}
                              {msg.isCorrect && <span className="ml-1">✓</span>}
                            </span>
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>

                <form onSubmit={handleSubmit} className="relative flex border-t border-white/20">
                  {showEmoteDropdown && filteredEmotes.length > 0 && (
                    <div
                      ref={emoteDropdownRef}
                      className="absolute left-0 right-0 bottom-full mb-1 glass rounded-lg overflow-hidden max-h-[240px] overflow-y-auto z-50"
                    >
                      {filteredEmotes.map((emote, index) => (
                        <div
                          key={emote.id}
                          onClick={() => selectEmote(emote)}
                          className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${
                            index === selectedEmoteIndex
                              ? 'bg-[#4a90d9]/40 border-l-4 border-[#4a90d9] text-white'
                              : 'hover:bg-white/10 text-white/90'
                          }`}
                        >
                          <span className="w-7 h-7 flex items-center justify-center shrink-0">
                            {emote.imageFile
                              ? <img src={emote.imageFile} alt={emote.code} className="w-6 h-6 object-contain" />
                              : <span className="text-white/30 text-xs">?</span>
                            }
                          </span>
                          <span className="text-sm font-mono text-white/70">:{emote.code}:</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {showDropdown && filteredSuggestions.length > 0 && (
                    <div
                      ref={dropdownRef}
                      id="autocomplete-dropdown"
                      role="listbox"
                      className="absolute left-0 right-0 bottom-full mb-1 glass rounded-lg overflow-hidden max-h-[240px] overflow-y-auto z-50"
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

          {/* Spacer droite */}
          <div className="hidden lg:block" />

          {/* Sidebar droite - Liste des joueurs */}
          <div>
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
