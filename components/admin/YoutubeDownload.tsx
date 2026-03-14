'use client';

import { useState } from 'react';

interface YoutubeDownloadProps {
  onDownload: (path: string) => void;
}

export default function YoutubeDownload({ onDownload }: YoutubeDownloadProps) {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleDownload = async () => {
    if (!url.trim() || isLoading) return;

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/admin/youtube-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(data.fileName);
        onDownload(data.path);
        setUrl('');
      } else {
        setError(data.error || 'Erreur lors du téléchargement');
      }
    } catch {
      setError('Erreur de connexion');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(''); setSuccess(''); }}
          onKeyDown={(e) => e.key === 'Enter' && handleDownload()}
          placeholder="https://www.youtube.com/watch?v=..."
          className="input-aero flex-1 px-4 py-3 text-white rounded-xl"
          disabled={isLoading}
        />
        <button
          type="button"
          onClick={handleDownload}
          disabled={!url.trim() || isLoading}
          className="btn-aero px-4 py-3 text-white rounded-xl disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Téléchargement...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 16l-5-5h3V4h4v7h3l-5 5zm-7 4v-2h14v2H5z" />
              </svg>
              Télécharger
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-400 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
          {error}
          <p className="text-red-400/60 text-xs mt-1">
            Upload le fichier MP3 manuellement via l&apos;onglet ci-dessus.
          </p>
        </div>
      )}

      {success && (
        <p className="text-green-400 text-sm">✓ Téléchargé : {success}</p>
      )}

      {isLoading && (
        <p className="text-white/40 text-xs">
          Le téléchargement peut prendre jusqu&apos;à 1-2 minutes...
        </p>
      )}
    </div>
  );
}
