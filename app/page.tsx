'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import CategorySelector from '@/components/CategorySelector';

export default function Home() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedRounds, setSelectedRounds] = useState(25);

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

    const savedRounds = sessionStorage.getItem('blindtest_rounds');
    if (savedRounds) {
      const rounds = parseInt(savedRounds, 10);
      if (!isNaN(rounds)) {
        setSelectedRounds(rounds);
      }
    }
  }, []);

  const handleSelectionChange = useCallback((selected: string[]) => {
    setSelectedCategories(selected);
    sessionStorage.setItem('blindtest_categories', JSON.stringify(selected));
  }, []);

  const handleRoundsChange = useCallback((rounds: number) => {
    setSelectedRounds(rounds);
    sessionStorage.setItem('blindtest_rounds', rounds.toString());
  }, []);

  return (
    <div className="min-h-screen aero-bg flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center max-w-lg w-full">
          {/* Logo / Title */}
          <div className="mb-8">
            <div className="w-28 h-28 mx-auto mb-5 flex items-center justify-center">
              <Image src="/logo.png" alt="Blindtest" width={112} height={112} className="drop-shadow-lg" />
            </div>
            <h1 className="text-5xl font-bold text-white mb-3 text-glow tracking-wide">
              BlindTest
            </h1>
            <p className="text-white/60 text-lg">
              Reconnaîtras-tu ces musiques cultes ?
            </p>
          </div>

          {/* Category Selector with Solo Button */}
          <div className="mb-6">
            <CategorySelector
              onSelectionChange={handleSelectionChange}
              initialSelection={selectedCategories.length > 0 ? selectedCategories : undefined}
              onRoundsChange={handleRoundsChange}
              initialRounds={selectedRounds}
            />
            <Link
              href="/game"
              className="btn-aero-green block w-full px-8 py-4 text-white text-xl font-semibold rounded-xl mt-4"
            >
              🎮 Jouer Solo
            </Link>
          </div>

          {/* Multiplayer Button */}
          <div className="mb-6">
            <Link
              href="/multi"
              className="btn-aero flex items-center justify-center gap-3 w-full px-8 py-4 text-white text-xl font-semibold rounded-xl"
            >
              <Image src="/icons/multi.png" alt="" width={32} height={32} />
              Multijoueur
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
