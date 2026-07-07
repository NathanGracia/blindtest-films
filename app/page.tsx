'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import CategorySelector from '@/components/CategorySelector';
import LadderSidebar from '@/components/LadderSidebar';
import UpdatesSidebar from '@/components/UpdatesSidebar';
import UserMenu from '@/components/UserMenu';
import { getSocket } from '@/lib/socket';
import { goToCoolossLogin } from '@/lib/coolossLogin';

interface CurrentUser {
  id: number;
  username: string;
  displayName?: string | null;
  avatarFile?: string | null;
  isAdmin?: boolean;
}

export default function Home() {
  const router = useRouter();
  const [pseudo, setPseudo] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedRounds, setSelectedRounds] = useState(25);
  const [selectedAnswerTime, setSelectedAnswerTime] = useState(30);
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // Charger la session utilisateur
  useEffect(() => {
    fetch('/api/user/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setCurrentUser(data.user);
          setPseudo(data.user.displayName || data.user.username);
        }
      })
      .catch(() => {});
  }, []);

  // Charger la sélection sauvegardée
  useEffect(() => {
    const savedPseudo = sessionStorage.getItem('blindtoss_pseudo');
    if (savedPseudo && !currentUser) {
      setPseudo(savedPseudo);
    }

    const saved = sessionStorage.getItem('blindtoss_categories');
    if (saved) {
      try {
        setSelectedCategories(JSON.parse(saved));
      } catch {
        // Ignorer les erreurs de parsing
      }
    }

    const savedRounds = sessionStorage.getItem('blindtoss_rounds');
    if (savedRounds) {
      const rounds = parseInt(savedRounds, 10);
      if (!isNaN(rounds)) {
        setSelectedRounds(rounds);
      }
    }

    const savedAnswerTime = sessionStorage.getItem('blindtoss_answer_time');
    if (savedAnswerTime) {
      const t = parseInt(savedAnswerTime, 10);
      if (!isNaN(t)) {
        setSelectedAnswerTime(Math.min(45, Math.max(3, t)));
      }
    }

    const savedDifficulties = sessionStorage.getItem('blindtoss_difficulties');
    if (savedDifficulties) {
      try {
        const arr = JSON.parse(savedDifficulties);
        if (Array.isArray(arr)) {
          setSelectedDifficulties(arr.filter((d: string) => ['easy', 'medium', 'hard'].includes(d)));
        }
      } catch {}
    }
  }, []);

  const handleSelectionChange = useCallback((selected: string[]) => {
    setSelectedCategories(selected);
    sessionStorage.setItem('blindtoss_categories', JSON.stringify(selected));
  }, []);

  const handleRoundsChange = useCallback((rounds: number) => {
    setSelectedRounds(rounds);
    sessionStorage.setItem('blindtoss_rounds', rounds.toString());
  }, []);

  const handleAnswerTimeChange = useCallback((time: number) => {
    setSelectedAnswerTime(time);
    sessionStorage.setItem('blindtoss_answer_time', time.toString());
  }, []);

  // Difficulté multi-sélection. Liste vide = toutes les difficultés.
  const toggleDifficulty = useCallback((value: string) => {
    setSelectedDifficulties((prev) => {
      const next = value === ''
        ? [] // "Tout" réinitialise (= toutes)
        : prev.includes(value)
          ? prev.filter((d) => d !== value)
          : [...prev, value];
      sessionStorage.setItem('blindtoss_difficulties', JSON.stringify(next));
      return next;
    });
  }, []);

  const handleCreatePrivate = () => {
    if (!pseudo.trim()) {
      setError('Entre un pseudo');
      return;
    }

    if (selectedCategories.length === 0) {
      setError('Sélectionne au moins une catégorie');
      return;
    }

    setIsLoading(true);
    setError('');

    const socket = getSocket();
    socket.on('connect_error', (err: Error) => {
      console.error('[home] socket connect_error', err);
      setError('Erreur de connexion au serveur');
      setIsLoading(false);
    });

    socket.emit('room:create', pseudo.trim(), selectedCategories, selectedRounds, selectedDifficulties, selectedAnswerTime, (code: string | null, errorMsg?: string) => {
      if (code) {
        sessionStorage.setItem('blindtoss_pseudo', pseudo.trim());
        try { sessionStorage.setItem('blindtoss_created_room', code); } catch {}
        router.push(`/multi/${code}`);
      } else {
        setError(errorMsg || 'Erreur lors de la création de la room');
        setIsLoading(false);
      }
    });
  };

  const handleJoinPublic = () => {
    if (!pseudo.trim()) {
      setError('Entre un pseudo');
      return;
    }

    setIsLoading(true);
    setError('');

    const socket = getSocket();
    socket.emit('room:join', 'PUBLIC', pseudo.trim(), (success: boolean, errorMsg?: string, finalPseudo?: string) => {
      if (success) {
        sessionStorage.setItem('blindtoss_pseudo', finalPseudo || pseudo.trim());
        router.push('/multi/PUBLIC');
      } else {
        setError(errorMsg || 'Impossible de rejoindre la partie publique');
        setIsLoading(false);
      }
    });
  };

  const handleJoinWithCode = () => {
    if (!pseudo.trim()) {
      setError('Entre un pseudo');
      return;
    }

    if (!roomCode.trim()) {
      setError('Entre un code de room');
      return;
    }

    setIsLoading(true);
    setError('');

    const socket = getSocket();
    socket.emit('room:join', roomCode.trim().toUpperCase(), pseudo.trim(), (success: boolean, errorMsg?: string, finalPseudo?: string) => {
      if (success) {
        sessionStorage.setItem('blindtoss_pseudo', finalPseudo || pseudo.trim());
        router.push(`/multi/${roomCode.trim().toUpperCase()}`);
      } else {
        setError(errorMsg || 'Impossible de rejoindre');
        setIsLoading(false);
      }
    });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    const savedPseudo = sessionStorage.getItem('blindtoss_pseudo');
    setPseudo(savedPseudo || '');
  };

  return (
    <div className="min-h-screen aero-bg flex flex-col">
      {/* Barre de navigation */}
      <div className="flex justify-end p-3 pr-4">
        <UserMenu
          user={currentUser}
          onLoginClick={goToCoolossLogin}
          onLogout={handleLogout}
        />
      </div>

      <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center p-4 gap-8">
        {/* Sidebar Nouveautés - centré dans l'espace de gauche */}
        <div className="hidden lg:flex justify-center">
          <UpdatesSidebar />
        </div>

        {/* Contenu principal centré */}
        <div className="text-center max-w-lg w-full col-start-2 lg:col-start-auto">
          {/* Logo / Title */}
          <div className="mb-8">
            <div className="w-28 h-28 mx-auto mb-5 flex items-center justify-center">
              <Image src="/logo.png" alt="BlindToss" width={112} height={112} className="drop-shadow-lg" />
            </div>
            <h1 className="text-5xl font-bold text-white mb-3 text-glow tracking-wide">
              BlindToss
            </h1>
            <p className="text-white/60 text-lg">
              Reconnaîtras-tu ces musiques cultes ?
            </p>
          </div>

          {/* Category Selector */}
          <div className="mb-6">
            <CategorySelector
              onSelectionChange={handleSelectionChange}
              initialSelection={selectedCategories.length > 0 ? selectedCategories : undefined}
              onRoundsChange={handleRoundsChange}
              initialRounds={selectedRounds}
              onAnswerTimeChange={handleAnswerTimeChange}
              initialAnswerTime={selectedAnswerTime}
            />
          </div>

          {/* Pseudo Input — uniquement pour les guests */}
          {!currentUser && (
            <div className="mb-6 glass rounded-xl p-5">
              <label className="block text-[#7ec8e3] text-sm mb-2 font-semibold text-left">
                Ton pseudo
              </label>
              <input
                type="text"
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                placeholder="Ex: MovieFan42"
                className="input-aero w-full px-4 py-3 text-white rounded-xl"
                maxLength={20}
              />
              <button
                onClick={goToCoolossLogin}
                className="mt-2 text-white/30 hover:text-white/60 text-xs transition-colors"
              >
                Créer un compte pour sauvegarder tes scores →
              </button>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 glass rounded-lg border border-red-500/50 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Sélecteur de difficulté (rooms privées) — multi-sélection */}
          <div className="mb-4 glass rounded-xl p-4">
            <label className="block text-[#7ec8e3] text-sm mb-3 font-semibold text-left">
              Difficulté (partie privée)
            </label>
            <div className="flex gap-2">
              {[
                { value: '', label: 'Tout' },
                { value: 'easy', label: 'Facile', color: '#7fba00' },
                { value: 'medium', label: 'Moyen', color: '#f5a623' },
                { value: 'hard', label: 'Difficile', color: '#e8445a' },
              ].map(({ value, label, color }) => {
                const isActive = value === ''
                  ? selectedDifficulties.length === 0
                  : selectedDifficulties.includes(value);
                return (
                  <button
                    key={value}
                    onClick={() => toggleDifficulty(value)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all border-2 ${
                      isActive
                        ? 'text-white'
                        : 'text-white/50 border-white/10 hover:border-white/30'
                    }`}
                    style={isActive && color ? {
                      backgroundColor: `${color}25`,
                      borderColor: color,
                      color,
                    } : isActive ? {
                      backgroundColor: 'rgba(126,200,227,0.2)',
                      borderColor: '#7ec8e3',
                      color: '#7ec8e3',
                    } : {}}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bouton Créer partie privée */}
          <div className="mb-6">
            <button
              onClick={handleCreatePrivate}
              disabled={isLoading}
              className="btn-aero flex items-center justify-center gap-3 w-full px-8 py-4 text-white text-xl font-semibold rounded-xl disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Création...
                </span>
              ) : (
                '🎮 Créer une partie privée'
              )}
            </button>
          </div>

          {/* Rejoindre avec code - Input + Bouton sur même ligne */}
          <div className="mb-6">
            <label className="block text-[#7ec8e3] text-sm mb-2 font-semibold text-left">
              Code de la room
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                className="input-aero flex-1 px-4 py-3 text-white rounded-xl uppercase tracking-[0.3em] text-center text-xl font-mono"
                maxLength={6}
              />
              <button
                onClick={handleJoinWithCode}
                disabled={isLoading}
                className="btn-aero px-6 py-3 text-white font-semibold rounded-xl disabled:opacity-50 whitespace-nowrap"
              >
                {isLoading ? 'Connexion...' : 'Rejoindre'}
              </button>
            </div>
          </div>

          {/* How to play */}
          <div className="mt-8 glass rounded-xl p-5">
            <h3 className="font-semibold text-[#7ec8e3] mb-4">
              Comment jouer ?
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-white/70">
                <span className="text-lg">🎧</span>
                <span>Écoute l&apos;extrait</span>
              </div>
              <div className="flex items-center gap-2 text-white/70">
                <span className="text-lg">⌨️</span>
                <span>Tape ta réponse</span>
              </div>
              <div className="flex items-center gap-2 text-white/70">
                <span className="text-lg">⏱️</span>
                <span>Plus vite = plus de points</span>
              </div>
              <div className="flex items-center gap-2 text-white/70">
                <span className="text-lg">🏆</span>
                <span>Jusqu&apos;à 1000 pts</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Ladder - centré dans l'espace de droite */}
        <div className="hidden lg:flex justify-center">
          <LadderSidebar onJoinPublic={handleJoinPublic} isJoining={isLoading} />
        </div>
      </div>

      {/* Footer */}
      <footer className="p-4 text-center">
        <a
          href="https://nathangracia.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/20 hover:text-white/40 text-xs transition-colors"
        >
          nathangracia.com
        </a>
      </footer>
    </div>
  );
}
