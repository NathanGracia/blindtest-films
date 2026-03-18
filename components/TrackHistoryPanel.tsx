'use client';

import { useRef, useEffect } from 'react';

export interface PlayedTrack {
  trackId: number;
  title: string;
  titleVF?: string | null;
  imageFile?: string | null;
  difficulty?: string | null;
  categoryId?: string | null;
  gotIt: boolean;
}

interface Props {
  tracks: PlayedTrack[];
  notes: Record<number, string>;
  isLoggedIn: boolean;
  onNoteChange: (trackId: number, note: string) => void;
  onNoteSave: (trackId: number, note: string) => void;
}

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string }> = {
  easy:   { label: 'Facile',   color: '#7fba00' },
  medium: { label: 'Moyen',    color: '#f5a623' },
  hard:   { label: 'Difficile', color: '#e8445a' },
};

function TrackCard({ track, note, isLoggedIn, onNoteChange, onNoteSave }: {
  track: PlayedTrack;
  note: string;
  isLoggedIn: boolean;
  onNoteChange: (note: string) => void;
  onNoteSave: (note: string) => void;
}) {
  const diff = track.difficulty ? DIFFICULTY_CONFIG[track.difficulty] : null;
  const radius = 10;

  return (
    <div className="glass rounded-xl overflow-hidden flex-shrink-0 w-48 flex flex-col">
      {/* Image style Vista */}
      <div
        className="relative w-full"
        style={{ height: 120 }}
      >
        {track.imageFile ? (
          <>
            <img
              src={track.imageFile}
              alt={track.title}
              className="w-full h-full object-cover"
            />
            {/* Reflet vitré */}
            <div
              className="absolute inset-x-0 top-0 pointer-events-none"
              style={{
                height: '50%',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.03) 100%)',
              }}
            />
            {/* Bord lumineux */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)',
              }}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white/5">
            <span className="text-4xl opacity-40">🎬</span>
          </div>
        )}

        {/* Badge ✓/✗ */}
        <div
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
          style={{
            backgroundColor: track.gotIt ? 'rgba(127,186,0,0.85)' : 'rgba(232,68,90,0.85)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
          }}
        >
          {track.gotIt ? '✓' : '✗'}
        </div>

        {/* Badge difficulté */}
        {diff && (
          <div
            className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-xs font-bold"
            style={{
              backgroundColor: `${diff.color}cc`,
              color: '#fff',
              boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
            }}
          >
            {diff.label}
          </div>
        )}
      </div>

      {/* Infos */}
      <div className="p-2 flex-1 flex flex-col gap-1.5">
        <div>
          <p className="text-white text-xs font-semibold leading-tight line-clamp-2">{track.title}</p>
          {track.titleVF && (
            <p className="text-white/50 text-xs leading-tight line-clamp-1">{track.titleVF}</p>
          )}
        </div>

        {/* Zone de note */}
        {isLoggedIn ? (
          <textarea
            value={note}
            onChange={(e) => onNoteChange(e.target.value.slice(0, 100))}
            onBlur={(e) => onNoteSave(e.target.value)}
            placeholder="Note... (trigger, indice...)"
            className="w-full text-xs px-2 py-1.5 rounded-lg resize-none bg-white/10 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#7ec8e3]/50 transition-colors leading-snug"
            rows={3}
          />
        ) : (
          <div className="text-xs text-white/30 italic px-1">
            Connectez-vous pour noter
          </div>
        )}

        {/* Compteur caractères */}
        {isLoggedIn && (
          <div className="text-right text-white/25 text-xs">{note.length}/100</div>
        )}
      </div>
    </div>
  );
}

export default function TrackHistoryPanel({ tracks, notes, isLoggedIn, onNoteChange, onNoteSave }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll vers la droite quand un nouveau track est ajouté
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [tracks.length]);

  if (tracks.length === 0) return null;

  return (
    <div className="glass rounded-xl p-3">
      <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2 px-1">
        Historique ({tracks.length} track{tracks.length > 1 ? 's' : ''})
      </p>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'thin' }}
      >
        {/* Afficher du plus récent au plus ancien */}
        {[...tracks].reverse().map((track) => (
          <TrackCard
            key={track.trackId}
            track={track}
            note={notes[track.trackId] ?? ''}
            isLoggedIn={isLoggedIn}
            onNoteChange={(note) => onNoteChange(track.trackId, note)}
            onNoteSave={(note) => onNoteSave(track.trackId, note)}
          />
        ))}
      </div>
    </div>
  );
}
