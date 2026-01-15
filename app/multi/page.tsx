'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSocket } from '@/lib/socket';
import CategorySelector from '@/components/CategorySelector';

export default function MultiLobby() {
  const router = useRouter();
  const [pseudo, setPseudo] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Charger la sélection sauvegardée
  useEffect(() => {
    const saved = sessionStorage.getItem('blindtest_categories');
    if (saved) {
      try {
        setSelectedCategories(JSON.parse(saved));
      } catch {
        // Ignorer les erreurs de parsing
      }
    }
  }, []);

  const handleSelectionChange = useCallback((selected: string[]) => {
    setSelectedCategories(selected);
    sessionStorage.setItem('blindtest_categories', JSON.stringify(selected));
  }, []);

  const handleCreate = () => {
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
      console.error('[multi] socket connect_error', err);
      setError('Erreur de connexion au serveur');
      setIsLoading(false);
    });

    socket.emit('room:create', pseudo.trim(), selectedCategories, (code: string | null, errorMsg?: string) => {
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

  const handleJoin = () => {
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

  return (
    <div className="min-h-screen aero-bg flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-8 max-w-md w-full">
        <Link href="/" className="text-white/60 hover:text-white mb-6 inline-flex items-center gap-2 transition-colors">
          ← Retour
        </Link>

        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#4a90d9]/20 flex items-center justify-center glow-blue">
            <span className="text-3xl">👥</span>
          </div>
          <h1 className="text-3xl font-bold text-white text-glow">
            Multijoueur
          </h1>
        </div>

        {/* Pseudo */}
        <div className="mb-6">
          <label className="block text-[#7ec8e3] text-sm mb-2 font-semibold">
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

        {/* Catégories pour la création */}
        <div className="mb-6">
          <CategorySelector
            onSelectionChange={handleSelectionChange}
            initialSelection={selectedCategories.length > 0 ? selectedCategories : undefined}
          />
        </div>

        {/* Partie publique */}
        <div className="mb-6">
          <button
            onClick={handleJoinPublic}
            disabled={isLoading}
            className="btn-aero w-full px-6 py-4 text-white text-lg font-semibold rounded-xl disabled:opacity-50 border-2 border-[#7ec8e3]/50"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Connexion...
              </span>
            ) : (
              '🌍 Rejoindre la partie publique'
            )}
          </button>
          <p className="text-white/40 text-xs text-center mt-2">
            Toutes les musiques • Joueurs aléatoires
          </p>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/20"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-transparent text-white/50">ou créer une partie privée</span>
          </div>
        </div>

        {/* Créer une partie privée */}
        <div className="mb-6">
          <button
            onClick={handleCreate}
            disabled={isLoading}
            className="btn-aero-green w-full px-6 py-4 text-white text-lg font-semibold rounded-xl disabled:opacity-50"
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

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/20"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-transparent text-white/50">ou rejoindre</span>
          </div>
        </div>

        {/* Rejoindre une partie */}
        <div className="space-y-3">
          <label className="block text-[#7ec8e3] text-sm font-semibold">
            Code de la room
          </label>
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            className="input-aero w-full px-4 py-3 text-white rounded-xl uppercase tracking-[0.3em] text-center text-xl font-mono"
            maxLength={6}
          />
          <button
            onClick={handleJoin}
            disabled={isLoading}
            className="btn-aero w-full px-6 py-3 text-white font-semibold rounded-xl disabled:opacity-50"
          >
            Rejoindre
          </button>
          <p className="text-white/40 text-xs text-center">
            Les catégories sont définies par l&apos;hôte de la partie
          </p>
        </div>
      </div>
    </div>
  );
}
