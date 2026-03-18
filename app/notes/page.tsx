'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface NoteEntry {
  id: number;
  note: string;
  updatedAt: string;
  track: {
    id: number;
    title: string;
    titleVF: string | null;
    imageFile: string | null;
    audioFile: string;
    startTime: number;
    difficulty: string | null;
    categoryId: string;
  };
}

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string }> = {
  easy:   { label: 'Facile',    color: '#7fba00' },
  medium: { label: 'Moyen',     color: '#f5a623' },
  hard:   { label: 'Difficile', color: '#e8445a' },
};

export default function NotesPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch('/api/user/notes')
      .then(res => {
        if (res.status === 401) { router.push('/'); return null; }
        return res.json();
      })
      .then(data => {
        if (data) setNotes(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  const togglePlay = (entry: NoteEntry) => {
    if (playingId === entry.track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(entry.track.audioFile);
    audio.currentTime = entry.track.startTime;
    audio.volume = 0.7;
    audio.play();
    audio.onended = () => setPlayingId(null);
    audioRef.current = audio;
    setPlayingId(entry.track.id);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  const filtered = notes.filter(e =>
    e.track.title.toLowerCase().includes(search.toLowerCase()) ||
    (e.track.titleVF || '').toLowerCase().includes(search.toLowerCase()) ||
    e.note.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen aero-bg flex flex-col items-center p-6">
      <div className="w-full max-w-3xl mb-6 flex items-center justify-between">
        <Link href="/" className="text-white/50 hover:text-white/80 text-sm transition-colors">
          ← Retour
        </Link>
        <span className="text-white/30 text-sm">{notes.length} note{notes.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="w-full max-w-3xl mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Mes notes</h1>
        <p className="text-white/40 text-sm">Vos indices et triggers sauvegardés en partie</p>
      </div>

      {/* Barre de recherche */}
      {notes.length > 0 && (
        <div className="w-full max-w-3xl mb-6">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un titre ou une note..."
            className="w-full glass rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none border border-white/10 focus:border-white/25 transition-colors"
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#7ec8e3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notes.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center w-full max-w-3xl">
          <p className="text-4xl mb-4 opacity-20">📝</p>
          <p className="text-white/40 text-sm">Aucune note encore. Jouez une partie et annotez les tracks dans l'historique.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center w-full max-w-3xl">
          <p className="text-white/40 text-sm">Aucun résultat pour "{search}"</p>
        </div>
      ) : (
        <div className="w-full max-w-3xl flex flex-col gap-3">
          {filtered.map(entry => {
            const diff = entry.track.difficulty ? DIFFICULTY_CONFIG[entry.track.difficulty] : null;
            const isPlaying = playingId === entry.track.id;

            return (
              <div
                key={entry.id}
                className="glass rounded-2xl overflow-hidden flex gap-0"
                style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}
              >
                {/* Image */}
                <div className="shrink-0 w-16 relative" style={{ aspectRatio: '2/3' }}>
                  {entry.track.imageFile ? (
                    <img
                      src={entry.track.imageFile}
                      alt={entry.track.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-white/5 flex items-center justify-center">
                      <span className="text-2xl opacity-20">🎬</span>
                    </div>
                  )}
                </div>

                {/* Contenu */}
                <div className="flex-1 p-4 flex flex-col gap-2 min-w-0">
                  {/* Titre + badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-white font-semibold text-sm leading-tight truncate">{entry.track.title}</p>
                      {entry.track.titleVF && (
                        <p className="text-white/40 text-xs leading-tight truncate">{entry.track.titleVF}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {diff && (
                        <span
                          className="text-xs font-bold px-1.5 py-0.5 rounded leading-none"
                          style={{ backgroundColor: `${diff.color}22`, color: diff.color, border: `1px solid ${diff.color}55` }}
                        >
                          {diff.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Note */}
                  <p
                    className="text-sm leading-snug px-3 py-2 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    {entry.note}
                  </p>

                  {/* Footer : date + play */}
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-white/25 text-xs">
                      {new Date(entry.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <button
                      onClick={() => togglePlay(entry)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: isPlaying ? 'rgba(126,200,227,0.2)' : 'rgba(255,255,255,0.08)',
                        color: isPlaying ? '#7ec8e3' : 'rgba(255,255,255,0.5)',
                        border: `1px solid ${isPlaying ? 'rgba(126,200,227,0.4)' : 'rgba(255,255,255,0.12)'}`,
                      }}
                    >
                      {isPlaying ? (
                        <>
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <rect x="6" y="4" width="4" height="16" rx="1" />
                            <rect x="14" y="4" width="4" height="16" rx="1" />
                          </svg>
                          Stop
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                          Écouter
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
