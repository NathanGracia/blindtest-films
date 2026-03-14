'use client';

import { useState, useEffect } from 'react';

interface ReportButtonProps {
  trackId: number;
  label?: string;
}

export default function ReportButton({ trackId, label }: ReportButtonProps) {
  const [isReported, setIsReported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    try {
      const reportedTracks = sessionStorage.getItem('blindtoss_reported_tracks');
      if (reportedTracks) {
        const reported = JSON.parse(reportedTracks) as number[];
        if (reported.includes(trackId)) {
          setIsReported(true);
        }
      }
    } catch {
      // Ignorer les erreurs sessionStorage
    }
  }, [trackId]);

  const handleReport = async () => {
    if (isReported || isLoading) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/tracks/${trackId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      });

      if (res.ok) {
        setIsReported(true);
        setIsOpen(false);
        try {
          const reportedTracks = sessionStorage.getItem('blindtoss_reported_tracks');
          const reported = reportedTracks ? JSON.parse(reportedTracks) : [];
          reported.push(trackId);
          sessionStorage.setItem('blindtoss_reported_tracks', JSON.stringify(reported));
        } catch {
          // Ignorer les erreurs sessionStorage
        }
      }
    } catch (error) {
      console.error('Erreur signalement:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isReported) {
    return <span className="text-xs px-2 py-1 text-white/40">✓ Signalé</span>;
  }

  if (isOpen) {
    return (
      <div className="flex flex-col gap-2 p-2 rounded-lg bg-white/5 border border-white/10">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 200))}
          placeholder="Décris le problème (optionnel)..."
          className="input-aero w-full px-3 py-2 text-white rounded-lg text-xs resize-none"
          rows={2}
          autoFocus
        />
        <div className="flex items-center gap-2">
          <span className="text-white/30 text-xs flex-1">{message.length}/200</span>
          <button
            onClick={() => { setIsOpen(false); setMessage(''); }}
            className="text-xs px-2 py-1 text-white/50 hover:text-white/80 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleReport}
            disabled={isLoading}
            className="text-xs px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all disabled:opacity-50"
          >
            {isLoading ? 'Envoi...' : 'Envoyer'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="text-xs px-2 py-1 rounded transition-all text-white/50 hover:text-red-400 hover:bg-red-400/10"
      title="Signaler un problème avec cette musique"
    >
      ⚠ {label || 'Signaler'}
    </button>
  );
}
