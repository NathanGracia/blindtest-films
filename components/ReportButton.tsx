'use client';

import { useState, useEffect } from 'react';

interface ReportButtonProps {
  trackId: number;
}

export default function ReportButton({ trackId }: ReportButtonProps) {
  const [isReported, setIsReported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Vérifier si déjà signalé dans cette session
  useEffect(() => {
    try {
      const reportedTracks = sessionStorage.getItem('blindtest_reported_tracks');
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
      });

      if (res.ok) {
        setIsReported(true);
        // Sauvegarder dans sessionStorage pour éviter les double reports
        try {
          const reportedTracks = sessionStorage.getItem('blindtest_reported_tracks');
          const reported = reportedTracks ? JSON.parse(reportedTracks) : [];
          reported.push(trackId);
          sessionStorage.setItem('blindtest_reported_tracks', JSON.stringify(reported));
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

  return (
    <button
      onClick={handleReport}
      disabled={isReported || isLoading}
      className={`text-xs px-2 py-1 rounded transition-all ${
        isReported
          ? 'text-white/40 cursor-default'
          : 'text-white/50 hover:text-red-400 hover:bg-red-400/10'
      }`}
      title={isReported ? 'Musique signalée' : 'Signaler un problème avec cette musique'}
    >
      {isLoading ? '...' : isReported ? '✓ Signalé' : '⚠ Signaler'}
    </button>
  );
}
