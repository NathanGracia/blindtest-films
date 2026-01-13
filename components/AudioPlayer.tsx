'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface AudioPlayerProps {
  src: string;
  isPlaying: boolean;
  onError?: () => void;
}

export default function AudioPlayer({ src, isPlaying, onError }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [hasError, setHasError] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const prevSrcRef = useRef<string>('');

  // Reset state when src changes
  useEffect(() => {
    if (src !== prevSrcRef.current) {
      prevSrcRef.current = src;
      setHasError(false);
      setIsReady(false);
      setIsLoading(true);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.load();
      }
    }
  }, [src]);

  // Handle play/pause
  useEffect(() => {
    if (!audioRef.current || hasError) return;

    if (isPlaying && isReady) {
      audioRef.current.play().catch((err) => {
        console.error('Play error:', err);
        setHasError(true);
        onError?.();
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, isReady, hasError, onError]);

  const handleCanPlay = useCallback(() => {
    setIsReady(true);
    setHasError(false);
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    console.error('Audio error for:', src);
    setHasError(true);
    setIsReady(false);
    setIsLoading(false);
    onError?.();
  }, [src, onError]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        {/* Outer glow ring */}
        <div
          className={`absolute inset-[-8px] rounded-full transition-opacity duration-300 ${
            isPlaying && isReady && !hasError ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            background: 'radial-gradient(circle, rgba(74, 144, 217, 0.4) 0%, transparent 70%)',
          }}
        />

        {/* Main disc */}
        <div
          className={`relative w-28 h-28 rounded-full flex items-center justify-center glass ${
            hasError ? 'border-red-500/50' : 'glow-blue'
          }`}
        >
          {isLoading ? (
            <div className="w-10 h-10 border-4 border-[#7ec8e3] border-t-transparent rounded-full animate-spin" />
          ) : hasError ? (
            <svg
              className="w-12 h-12 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          ) : isPlaying && isReady ? (
            <div className="flex gap-1.5 items-end h-12">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-2 bg-gradient-to-t from-[#4a90d9] to-[#7ec8e3] rounded-full animate-pulse"
                  style={{
                    height: `${16 + Math.sin(i * 1.2) * 16 + 8}px`,
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: '0.5s',
                  }}
                />
              ))}
            </div>
          ) : (
            <svg
              className="w-14 h-14 text-[#7ec8e3]"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </div>

        {/* Animated ring when playing */}
        {isPlaying && isReady && !hasError && (
          <div
            className="absolute inset-[-4px] rounded-full border-2 border-[#4a90d9]/50 animate-ping"
            style={{ animationDuration: '2s' }}
          />
        )}
      </div>

      {/* File path display (only show on error) */}
      {hasError && (
        <div className="text-center glass rounded-lg px-4 py-2">
          <p className="text-red-400 text-sm">Fichier audio introuvable</p>
          <code className="text-red-300 text-xs">{src}</code>
        </div>
      )}

      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        onCanPlay={handleCanPlay}
        onError={handleError}
      />
    </div>
  );
}
