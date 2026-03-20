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

interface LadderSidebarProps {
  onJoinPublic?: () => void;
  isJoining?: boolean;
}

const RANK_CONFIG: Record<number, { gradient: string; border: string; glow: string; medal: string; textColor: string }> = {
  1: {
    gradient: 'linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(255,180,0,0.08) 100%)',
    border: 'rgba(255,215,0,0.35)',
    glow: '0 0 12px rgba(255,215,0,0.2)',
    medal: '🥇',
    textColor: '#ffd700',
  },
  2: {
    gradient: 'linear-gradient(135deg, rgba(192,192,192,0.15) 0%, rgba(160,160,160,0.08) 100%)',
    border: 'rgba(192,192,192,0.3)',
    glow: '0 0 8px rgba(192,192,192,0.15)',
    medal: '🥈',
    textColor: '#d0d0d0',
  },
  3: {
    gradient: 'linear-gradient(135deg, rgba(205,127,50,0.15) 0%, rgba(180,100,30,0.08) 100%)',
    border: 'rgba(205,127,50,0.3)',
    glow: '0 0 8px rgba(205,127,50,0.15)',
    medal: '🥉',
    textColor: '#cd7f32',
  },
};

export default function LadderSidebar({ onJoinPublic, isJoining }: LadderSidebarProps) {
  const [entries, setEntries] = useState<LadderEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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
      <div className="glass rounded-2xl p-5 w-80">
        <div className="animate-pulse text-white/40 text-center text-sm py-8">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl w-80 flex flex-col overflow-hidden" style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)' }}>

      {/* Header */}
      <div className="relative px-5 pt-5 pb-4 shrink-0">
        {/* Ligne décorative top */}
        <div className="absolute top-0 left-6 right-6 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.5), rgba(126,200,227,0.5), transparent)' }} />

        {/* Icône trophée */}
        <div className="flex items-center gap-3 mb-1">
          <div className="relative">
            <span className="text-3xl leading-none" style={{ filter: 'drop-shadow(0 0 8px rgba(255,215,0,0.6))' }}>🏆</span>
          </div>
          <div>
            <h3
              className="font-black text-base leading-tight tracking-wide uppercase"
              style={{
                background: 'linear-gradient(90deg, #ffd700 0%, #7ec8e3 60%, #ffd700 100%)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                animation: mounted ? 'shimmer 4s linear infinite' : undefined,
                textShadow: 'none',
              }}
            >
              Classement
            </h3>
            <p className="text-white/35 text-xs tracking-widest uppercase">Partie publique</p>
          </div>
        </div>

        <style>{`
          @keyframes shimmer {
            0% { background-position: 0% center; }
            100% { background-position: 200% center; }
          }
          @keyframes fadeSlideIn {
            from { opacity: 0; transform: translateX(8px); }
            to { opacity: 1; transform: translateX(0); }
          }
        `}</style>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-1.5" style={{ scrollbarWidth: 'none' }}>
        {entries.length === 0 ? (
          <div className="text-white/30 text-sm text-center py-10 italic">
            Aucun score pour l'instant.<br/>Sois le premier !
          </div>
        ) : entries.map((entry, i) => {
          const cfg = RANK_CONFIG[entry.rank];
          const isTop3 = entry.rank <= 3;

          return (
            <div
              key={entry.rank}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-200 hover:brightness-110"
              style={{
                background: cfg ? cfg.gradient : i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'transparent',
                border: `1px solid ${cfg ? cfg.border : 'rgba(255,255,255,0.06)'}`,
                boxShadow: cfg ? cfg.glow : 'none',
                animation: mounted ? `fadeSlideIn 0.3s ease ${i * 0.05}s both` : undefined,
              }}
            >
              {/* Avatar */}
              <div className="relative shrink-0">
                <UserAvatar avatarFile={entry.avatarFile} pseudo={entry.pseudo} size={32} />
                {isTop3 ? (
                  <span className="absolute -bottom-1 -right-1 text-xs leading-none">{cfg.medal}</span>
                ) : (
                  <span
                    className="absolute -bottom-1 -right-1 text-[9px] font-black leading-none px-1 rounded"
                    style={{ background: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums' }}
                  >
                    #{entry.rank}
                  </span>
                )}
              </div>

              {/* Pseudo + parties */}
              <div className="flex-1 min-w-0">
                {entry.username ? (
                  <Link
                    href={`/profile/${entry.username}`}
                    className="block font-semibold text-sm truncate hover:underline leading-tight"
                    style={{ color: cfg ? cfg.textColor : 'rgba(255,255,255,0.85)' }}
                  >
                    {entry.pseudo}
                  </Link>
                ) : (
                  <div
                    className="font-semibold text-sm truncate leading-tight"
                    style={{ color: cfg ? cfg.textColor : 'rgba(255,255,255,0.85)' }}
                  >
                    {entry.pseudo}
                  </div>
                )}
                <div className="text-white/30 text-xs leading-tight">
                  {entry.gamesPlayed} partie{entry.gamesPlayed > 1 ? 's' : ''}
                </div>
              </div>

              {/* Score */}
              <div
                className="shrink-0 font-mono font-black text-sm tabular-nums"
                style={{
                  color: cfg ? cfg.textColor : '#7ec8e3',
                  textShadow: cfg ? `0 0 10px ${cfg.textColor}80` : '0 0 8px rgba(126,200,227,0.4)',
                  letterSpacing: '-0.02em',
                }}
              >
                {entry.bestScore.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Séparateur */}
      <div className="mx-4 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }} />

      {/* Footer + bouton */}
      <div className="px-4 py-4 shrink-0 flex flex-col gap-3">
        {onJoinPublic && (
          <button
            onClick={onJoinPublic}
            disabled={isJoining}
            className="btn-aero-green w-full py-3 text-white font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 text-sm tracking-wide"
          >
            {isJoining ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Connexion...
              </>
            ) : (
              <>
                <span>🌍</span>
                Rejoindre la partie publique
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
