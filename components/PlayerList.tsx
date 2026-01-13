'use client';

import { Player } from '@/types';

interface PlayerListProps {
  players: Player[];
  hostId: string;
  currentPlayerId?: string;
  winnerId?: string;
}

export default function PlayerList({ players, hostId, currentPlayerId, winnerId }: PlayerListProps) {
  // Trier par score décroissant
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="glass rounded-xl p-4">
      <h3 className="text-[#7ec8e3] text-sm mb-3 font-semibold">
        Joueurs ({players.length})
      </h3>
      <div className="space-y-2">
        {sortedPlayers.map((player, index) => (
          <div
            key={player.id}
            className={`flex items-center justify-between p-3 rounded-lg transition-all ${
              player.id === winnerId
                ? 'bg-[#7fba00]/20 border border-[#7fba00]/50 animate-pulse'
                : player.id === currentPlayerId
                ? 'bg-[#4a90d9]/20 border border-[#4a90d9]/50'
                : 'bg-white/5 border border-white/10'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-white/50 text-sm w-5 text-center font-bold">
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
              </span>
              <span className={`${player.id === currentPlayerId ? 'text-[#7ec8e3]' : 'text-white'}`}>
                {player.pseudo}
              </span>
              {player.id === hostId && (
                <span className="text-xs bg-[#4a90d9]/30 text-[#7ec8e3] px-2 py-0.5 rounded border border-[#4a90d9]/50">
                  Hôte
                </span>
              )}
              {player.id === winnerId && (
                <span className="text-[#7fba00]">✓</span>
              )}
            </div>
            <span className="text-[#7fba00] font-bold text-lg">{player.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
