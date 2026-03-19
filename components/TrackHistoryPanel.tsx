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
  noteSaveStatus: Record<number, 'saving' | 'saved'>;
  isLoggedIn: boolean;
  onNoteChange: (trackId: number, note: string) => void;
  onNoteSave: (trackId: number, note: string) => void;
  onFocusAnswerInput?: () => void;
}

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string }> = {
  easy:   { label: 'Facile',    color: '#7fba00' },
  medium: { label: 'Moyen',     color: '#f5a623' },
  hard:   { label: 'Difficile', color: '#e8445a' },
};

function TrackCard({ track, note, saveStatus, isLoggedIn, onNoteChange, onNoteSave, noteIndex, onFocusAnswerInput }: {
  track: PlayedTrack;
  note: string;
  saveStatus?: 'saving' | 'saved';
  isLoggedIn: boolean;
  onNoteChange: (note: string) => void;
  onNoteSave: (note: string) => void;
  noteIndex: number;
  onFocusAnswerInput?: () => void;
}) {
  const diff = track.difficulty ? DIFFICULTY_CONFIG[track.difficulty] : null;
  const accentColor = track.gotIt ? '#7fba00' : '#e8445a';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();

    const allNotes = Array.from(document.querySelectorAll<HTMLTextAreaElement>('[data-history-note]'));
    if (e.shiftKey) {
      if (noteIndex > 0) {
        allNotes[noteIndex - 1]?.focus();
      } else {
        onFocusAnswerInput?.();
      }
    } else {
      if (noteIndex < allNotes.length - 1) {
        allNotes[noteIndex + 1]?.focus();
      } else {
        onFocusAnswerInput?.();
      }
    }
  };

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col relative"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.3)', minHeight: 240 }}
    >
      {track.imageFile ? (
        <img src={track.imageFile} alt={track.title} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-white/5 flex items-center justify-center">
          <span className="text-4xl opacity-20">🎬</span>
        </div>
      )}

      <div className="relative z-10 shrink-0" style={{ height: 3, background: `linear-gradient(90deg, ${accentColor}ee, ${accentColor}44)` }} />
      <div className="flex-1 relative z-10" style={{ minHeight: 110 }} />

      <div
        className="relative z-10 p-3 flex flex-col gap-2"
        style={{ background: 'linear-gradient(180deg, rgba(0,15,20,0.55) 0%, rgba(0,10,15,0.82) 100%)', backdropFilter: 'blur(8px)' }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold leading-tight line-clamp-2">{track.title}</p>
            {track.titleVF && (
              <p className="text-white/45 text-xs leading-tight line-clamp-1 mt-0.5">{track.titleVF}</p>
            )}
          </div>
          {diff && (
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded shrink-0 leading-none"
              style={{ backgroundColor: `${diff.color}33`, color: diff.color, border: `1px solid ${diff.color}66` }}
            >
              {diff.label}
            </span>
          )}
        </div>

        {isLoggedIn ? (
          <>
            <textarea
              data-history-note
              value={note}
              onChange={(e) => onNoteChange(e.target.value.slice(0, 100))}
              onBlur={(e) => onNoteSave(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Notes personnelles"
              autoComplete="off"
              className="w-full text-xs px-2 py-1.5 rounded-lg resize-none text-white placeholder-white/25 focus:outline-none transition-colors leading-snug"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
              rows={2}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs">
                {saveStatus === 'saved' && <span style={{ color: '#7fba00' }}>✓ Sauvegardé</span>}
                {saveStatus === 'saving' && <span className="text-white/30">Envoi...</span>}
              </span>
              <span className="text-white/20 text-xs">{note.length}/100</span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function TrackHistoryPanel({ tracks, notes, noteSaveStatus, isLoggedIn, onNoteChange, onNoteSave, onFocusAnswerInput }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [tracks.length]);

  if (tracks.length === 0) {
    return (
      <div className="glass rounded-xl p-4 flex flex-col items-center justify-center gap-2 py-10">
        <span className="text-white/15 text-3xl">📋</span>
        <p className="text-white/20 text-xs text-center">L'historique apparaîtra ici</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-4 flex flex-col gap-3 h-full">
      <div className="shrink-0 flex flex-col gap-1">
        <p className="text-[#7ec8e3] text-sm font-semibold">Historique ({tracks.length})</p>
        {!isLoggedIn && (
          <p className="text-white/30 text-xs italic">Connectez-vous pour enregistrer des notes</p>
        )}
      </div>
      <div
        ref={scrollRef}
        className="flex flex-col gap-4 overflow-y-auto flex-1 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        {tracks.map((track, index) => (
          <TrackCard
            key={track.trackId}
            track={track}
            note={notes[track.trackId] ?? ''}
            saveStatus={noteSaveStatus[track.trackId]}
            isLoggedIn={isLoggedIn}
            onNoteChange={(note) => onNoteChange(track.trackId, note)}
            onNoteSave={(note) => onNoteSave(track.trackId, note)}
            noteIndex={index}
            onFocusAnswerInput={onFocusAnswerInput}
          />
        ))}
      </div>
    </div>
  );
}
