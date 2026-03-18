'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import UserAvatar from '@/components/UserAvatar';

interface LadderEntry {
  rank: number;
  pseudo: string;
  bestScore: number;
  gamesPlayed: number;
  avatarFile?: string | null;
  username?: string | null;
}

export default function LadderSidebar() {
  const [entries, setEntries] = useState<LadderEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLadder = async () => {
      try {
        const res = await fetch('/api/ladder');
        const data = await res.json();
        setEntries(data.entries || []);
      } catch (error) {
        console.error('Erreur chargement ladder:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLadder();
    const interval = setInterval(fetchLadder, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="glass rounded-xl p-4 w-72">
        <div className="animate-pulse text-white/40 text-center">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-5 w-72 max-h-[600px] overflow-y-auto">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[#7ec8e3] font-bold text-lg flex items-center gap-2">
          <span className="text-2xl">🏆</span>
          Meilleurs scores
        </h3>
      </div>


      {entries.length === 0 ? (
        <div className="text-white/40 text-sm text-center py-8">
          Aucun score pour l'instant.<br/>Sois le premier !
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.rank}
              className={`
                flex items-center gap-3 p-3 rounded-lg
                ${entry.rank === 1 ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30' : ''}
                ${entry.rank === 2 ? 'bg-gradient-to-r from-gray-400/20 to-gray-500/10 border border-gray-400/30' : ''}
                ${entry.rank === 3 ? 'bg-gradient-to-r from-orange-600/20 to-orange-700/10 border border-orange-600/30' : ''}
                ${entry.rank > 3 ? 'bg-white/5' : ''}
              `}
            >
              {/* Avatar + badge rang */}
              <div className="relative flex-shrink-0">
                <UserAvatar avatarFile={entry.avatarFile} pseudo={entry.pseudo} size={36} />
                <div className="absolute -bottom-1 -right-1 text-sm leading-none">
                  {entry.rank === 1 && '🥇'}
                  {entry.rank === 2 && '🥈'}
                  {entry.rank === 3 && '🥉'}
                  {entry.rank > 3 && (
                    <span className="bg-black/60 text-white/50 font-mono text-[10px] px-1 rounded">
                      #{entry.rank}
                    </span>
                  )}
                </div>
              </div>

              {/* Pseudo */}
              <div className="flex-1 min-w-0">
                {entry.username ? (
                  <Link href={`/profile/${entry.username}`} className={`font-semibold truncate block hover:underline ${entry.rank === 1 ? 'text-yellow-300 text-glow' : 'text-white'}`}>
                    {entry.pseudo}
                  </Link>
                ) : (
                  <div className={`font-semibold truncate ${entry.rank === 1 ? 'text-yellow-300 text-glow' : 'text-white'}`}>
                    {entry.pseudo}
                  </div>
                )}
                <div className="text-white/40 text-xs">
                  {entry.gamesPlayed} partie{entry.gamesPlayed > 1 ? 's' : ''}
                </div>
              </div>

              {/* Score */}
              <div className={`flex-shrink-0 font-mono font-bold text-right ${entry.rank === 1 ? 'text-yellow-300 text-lg' : 'text-[#7ec8e3]'}`}>
                {entry.bestScore.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-white/10 text-white/40 text-xs text-center">
        Classement général
      </div>
    </div>
  );
}
