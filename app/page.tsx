'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import CategorySelector from '@/components/CategorySelector';
import { getSocket } from '@/lib/socket';

export default function Home() {
  const router = useRouter();
  const [pseudo, setPseudo] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedRounds, setSelectedRounds] = useState(25);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Charger la sélection sauvegardée
  useEffect(() => {
    const savedPseudo = sessionStorage.getItem('blindtest_pseudo');
    if (savedPseudo) {
      setPseudo(savedPseudo);
    }

    const saved = sessionStorage.getItem('blindtest_categories');
    if (saved) {
      try {
        setSelectedCategories(JSON.parse(saved));
      } catch {
        // Ignorer les erreurs de parsing
      }
    }

    const savedRounds = sessionStorage.getItem('blindtest_rounds');
    if (savedRounds) {
      const rounds = parseInt(savedRounds, 10);
      if (!isNaN(rounds)) {
        setSelectedRounds(rounds);
      }
    }
  }, []);

  const handleSelectionChange = useCallback((selected: string[]) => {
    setSelectedCategories(selected);
    sessionStorage.setItem('blindtest_categories', JSON.stringify(selected));
  }, []);

  const handleRoundsChange = useCallback((rounds: number) => {
    setSelectedRounds(rounds);
    sessionStorage.setItem('blindtest_rounds', rounds.toString());
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

    socket.emit('room:create', pseudo.trim(), selectedCategories, selectedRounds, (code: string | null, errorMsg?: string) => {
      if (code) {
        sessionStorage.setItem('blindtest_pseudo', pseudo.trim());
        try { sessionStorage.setItem('blindtest_created_room', code); } catch {}
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
        sessionStorage.setItem('blindtest_pseudo', finalPseudo || pseudo.trim());
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
        sessionStorage.setItem('blindtest_pseudo', finalPseudo || pseudo.trim());
        router.push(`/multi/${roomCode.trim().toUpperCase()}`);
      } else {
        setError(errorMsg || 'Impossible de rejoindre');
        setIsLoading(false);
      }
    });
  };

  return (
    <div className="min-h-screen aero-bg flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center max-w-lg w-full">
          {/* Logo / Title */}
          <div className="mb-8">
            <div className="w-28 h-28 mx-auto mb-5 flex items-center justify-center">
              <Image src="/logo.png" alt="Blindtest" width={112} height={112} className="drop-shadow-lg" />
            </div>
            <h1 className="text-5xl font-bold text-white mb-3 text-glow tracking-wide">
              BlindTest
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
            />
          </div>

          {/* Pseudo Input - Dans une card */}
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
          </div>

          {error && (
            <div className="mb-4 p-3 glass rounded-lg border border-red-500/50 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Bouton Créer partie privée */}
          <div className="mb-4">
            <button
              onClick={handleCreatePrivate}
              disabled={isLoading}
              className="btn-aero-green flex items-center justify-center gap-3 w-full px-8 py-4 text-white text-xl font-semibold rounded-xl disabled:opacity-50"
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

          {/* Bouton Rejoindre partie publique */}
          <div className="mb-6">
            <button
              onClick={handleJoinPublic}
              disabled={isLoading}
              className="btn-aero flex items-center justify-center gap-3 w-full px-8 py-4 text-white text-xl font-semibold rounded-xl disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Connexion...
                </span>
              ) : (
                '🌍 Rejoindre partie publique'
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
      </div>

      {/* Footer with Admin Link */}
      <footer className="p-4 text-center">
        <Link
          href="/admin"
          className="text-white/20 hover:text-white/40 text-xs transition-colors"
        >
          Administration
        </Link>
      </footer>
    </div>
  );
}
