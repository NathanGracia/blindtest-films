'use client';

import { Player } from '@/types';
import UserAvatar from '@/components/UserAvatar';

interface PlayerListProps {
  players: Player[];
  hostId: string | null;
  currentPlayerId?: string;
  roundFinders?: string[];
}

export default function PlayerList({ players, hostId, currentPlayerId, roundFinders = [] }: PlayerListProps) {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="glass rounded-xl p-4">
      <h3 className="text-[#7ec8e3] text-sm mb-3 font-semibold">
        Joueurs ({players.length})
      </h3>
      <div className="space-y-2">
        {sortedPlayers.map((player, index) => {
          const hasFound = roundFinders.includes(player.id);
          return (
            <div
              key={player.id}
              className={`flex items-center justify-between p-2.5 rounded-lg transition-all ${
                hasFound
                  ? 'bg-[#7fba00]/20 border border-[#7fba00]/50'
                  : player.id === currentPlayerId
                  ? 'bg-[#4a90d9]/20 border border-[#4a90d9]/50'
                  : 'bg-white/5 border border-white/10'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-white/50 text-sm w-5 text-center font-bold shrink-0">
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                </span>
                <UserAvatar avatarFile={player.avatarFile} pseudo={player.pseudo} size={28} />
                <span className={`text-sm ${player.id === currentPlayerId ? 'text-[#7ec8e3] font-semibold' : 'text-white'}`}>
                  {player.pseudo}
                </span>
                {player.id === hostId && (
                  <span className="text-xs bg-[#4a90d9]/30 text-[#7ec8e3] px-1.5 py-0.5 rounded border border-[#4a90d9]/50">
                    Hôte
                  </span>
                )}
                {hasFound && (
                  <span className="text-[#7fba00] text-sm">✓</span>
                )}
              </div>
              <span className="text-[#7fba00] font-bold">{player.score}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
