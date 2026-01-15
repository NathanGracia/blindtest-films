'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import CategorySelector from '@/components/CategorySelector';

export default function Home() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Charger la sélection sauvegardée
  useEffect(() => {
    const saved = sessionStorage.getItem('blindtest_categories');
    if (saved) {
      try {
        setSelectedCategories(JSON.parse(saved));
      } catch {
        // Ignorer les erreurs de parsing
      }
    }
  }, []);

  const handleSelectionChange = useCallback((selected: string[]) => {
    setSelectedCategories(selected);
    sessionStorage.setItem('blindtest_categories', JSON.stringify(selected));
  }, []);

  return (
    <div className="min-h-screen aero-bg flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center max-w-lg w-full">
          {/* Logo / Title */}
          <div className="mb-8">
            <div className="glass rounded-full w-28 h-28 mx-auto mb-5 flex items-center justify-center glow-blue">
              <span className="text-5xl">🎵</span>
            </div>
            <h1 className="text-5xl font-bold text-white mb-3 text-glow tracking-wide">
              BlindTest
            </h1>
            <p className="text-white/60 text-lg">
              Reconnaîtras-tu ces musiques cultes ?
            </p>
          </div>

          {/* Category Selector */}
          <div className="mb-6">
            <CategorySelector
              onSelectionChange={handleSelectionChange}
              initialSelection={selectedCategories.length > 0 ? selectedCategories : undefined}
            />
          </div>

          {/* Buttons */}
          <div className="space-y-3">
            <Link
              href="/game"
              className="btn-aero-green block w-full px-8 py-4 text-white text-xl font-semibold rounded-xl"
            >
              🎮 Jouer Solo
            </Link>
            <Link
              href="/multi"
              className="btn-aero block w-full px-8 py-4 text-white text-xl font-semibold rounded-xl"
            >
              👥 Multijoueur
            </Link>
          </div>

          {/* How to play */}
          <div className="mt-8 glass rounded-xl p-5">
            <h3 className="font-semibold text-[#7ec8e3] mb-4">
              Comment jouer ?
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-white/70">
                <span className="text-lg">🎧</span>
                <span>Écoute l&apos;extrait</span>
              </div>
              <div className="flex items-center gap-2 text-white/70">
                <span className="text-lg">⌨️</span>
                <span>Tape ta réponse</span>
              </div>
              <div className="flex items-center gap-2 text-white/70">
                <span className="text-lg">⏱️</span>
                <span>Plus vite = plus de points</span>
              </div>
              <div className="flex items-center gap-2 text-white/70">
                <span className="text-lg">🏆</span>
                <span>Jusqu&apos;à 1000 pts</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer with Admin Link */}
      <footer className="p-4 text-center">
        <Link
          href="/admin"
          className="text-white/20 hover:text-white/40 text-xs transition-colors"
        >
          Administration
        </Link>
      </footer>
    </div>
  );
}
